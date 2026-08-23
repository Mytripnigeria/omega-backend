import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChowdeckClient,
  ChowdeckApiError,
  type ChowdeckCredentials,
} from './chowdeck.client';
import { ChowdeckIntegrationEntity } from './entities/chowdeck-integration.entity';
import { ChowdeckMenuItemEntity } from './entities/chowdeck-menu-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { UpsertChowdeckIntegrationDto } from './dto/chowdeck-integration.dto';
import { randomBytes } from 'crypto';

/** Naira ⇄ kobo. Chowdeck quotes every amount in kobo. */
export const toKobo = (naira: number): number => Math.round(Number(naira) * 100);
export const fromKobo = (kobo: number): number => Number(kobo) / 100;

@Injectable()
export class ChowdeckService {
  private readonly logger = new Logger(ChowdeckService.name);

  constructor(
    @InjectRepository(ChowdeckIntegrationEntity)
    private readonly integrationRepo: Repository<ChowdeckIntegrationEntity>,
    @InjectRepository(ChowdeckMenuItemEntity)
    private readonly menuMapRepo: Repository<ChowdeckMenuItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly client: ChowdeckClient,
  ) {}

  // ───────────────────────── configuration ─────────────────────────

  /** Integration row including the secret — internal use only. */
  async findWithSecret(
    where: Partial<Pick<ChowdeckIntegrationEntity, 'id' | 'storeId'>>,
  ): Promise<ChowdeckIntegrationEntity | null> {
    return this.integrationRepo.findOne({
      where,
      select: {
        id: true,
        businessId: true,
        storeId: true,
        merchantReference: true,
        label: true,
        secretKey: true,
        baseUrl: true,
        isEnabled: true,
        autoAccept: true,
        webhookToken: true,
      },
    });
  }

  /** Every enabled integration, with secrets — used to route webhooks. */
  async listEnabledWithSecrets(): Promise<ChowdeckIntegrationEntity[]> {
    return this.integrationRepo.find({
      where: { isEnabled: true },
      select: {
        id: true,
        businessId: true,
        storeId: true,
        merchantReference: true,
        label: true,
        secretKey: true,
        baseUrl: true,
        isEnabled: true,
        autoAccept: true,
        webhookToken: true,
      },
    });
  }

  credentialsOf(integration: ChowdeckIntegrationEntity): ChowdeckCredentials {
    return {
      merchantReference: integration.merchantReference,
      secretKey: integration.secretKey,
      baseUrl: integration.baseUrl,
    };
  }

  /** Safe view for the merchant hub: the key is masked, never returned raw. */
  private present(integration: ChowdeckIntegrationEntity, secret?: string) {
    return {
      id: integration.id,
      storeId: integration.storeId,
      label: integration.label ?? null,
      merchantReference: integration.merchantReference,
      baseUrl: integration.baseUrl,
      isEnabled: integration.isEnabled,
      autoAccept: integration.autoAccept,
      secretKeyPreview: secret ? `${secret.slice(0, 11)}…${secret.slice(-4)}` : null,
      lastMenuSyncAt: integration.lastMenuSyncAt ?? null,
      lastWebhookAt: integration.lastWebhookAt ?? null,
    };
  }

  /**
   * Every Chowdeck channel on a store. A store may sell through more than one
   * vendor listing, so this is a list rather than a single row.
   */
  async listChannels(businessId: string, storeId: string) {
    const rows = await this.integrationRepo.find({
      where: { businessId, storeId },
      order: { createdAt: 'ASC' },
    });
    const withSecrets = await Promise.all(
      rows.map(async (r) => {
        const s = await this.findWithSecret({ id: r.id });
        return this.present(r, s?.secretKey);
      }),
    );
    return withSecrets;
  }

  /** Back-compat single-channel read: the first channel on the store. */
  async getConfig(businessId: string, storeId: string) {
    const [first] = await this.listChannels(businessId, storeId);
    return first ?? null;
  }

  async upsertConfig(
    businessId: string,
    storeId: string,
    dto: UpsertChowdeckIntegrationDto,
    channelId?: string,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store || store.businessId !== businessId) {
      throw new NotFoundException('Store not found');
    }

    // `channelId` selects which of the store's channels to edit. Without one
    // this is a new channel — a store may hold several.
    const existing = channelId
      ? await this.findWithSecret({ id: channelId })
      : null;
    if (channelId && (!existing || existing.storeId !== storeId)) {
      throw new NotFoundException('Chowdeck channel not found on this store');
    }
    if (!existing && !dto.secretKey) {
      throw new BadRequestException(
        'A Chowdeck secret key is required the first time you connect a channel',
      );
    }

    const entity = existing ?? this.integrationRepo.create({ businessId, storeId });
    entity.businessId = businessId;
    entity.storeId = storeId;
    if (dto.merchantReference !== undefined) {
      entity.merchantReference = dto.merchantReference.trim();
    }
    if (dto.label !== undefined) entity.label = dto.label?.trim() || null;
    // Omitting the key on an update keeps the stored one — the hub only ever
    // sees a masked preview, so it cannot echo the real value back.
    if (dto.secretKey) entity.secretKey = dto.secretKey.trim();
    if (dto.baseUrl !== undefined) {
      entity.baseUrl = dto.baseUrl?.trim() || 'https://api.chowdeck.com';
    }
    if (dto.isEnabled !== undefined) entity.isEnabled = dto.isEnabled;
    if (dto.autoAccept !== undefined) entity.autoAccept = dto.autoAccept;
    if (!entity.webhookToken) entity.webhookToken = randomBytes(24).toString('hex');

    const saved = await this.integrationRepo.save(entity);
    return this.present(saved, entity.secretKey);
  }

  async removeConfig(
    businessId: string,
    storeId: string,
    channelId?: string,
  ): Promise<void> {
    const existing = await this.requireIntegration(
      businessId,
      storeId,
      channelId,
    );
    // Only this channel's mappings — the store's other channels keep theirs.
    await this.menuMapRepo.delete({ integrationId: existing.id });
    await this.integrationRepo.delete({ id: existing.id });
  }

  /** The URL the merchant pastes into Chowdeck's dashboard. */
  async webhookUrl(
    businessId: string,
    storeId: string,
    publicBase: string,
    channelId?: string,
  ): Promise<string | null> {
    let row: ChowdeckIntegrationEntity | null;
    try {
      row = await this.requireIntegration(businessId, storeId, channelId);
    } catch {
      return null;
    }
    if (!row || row.businessId !== businessId) return null;
    const base = publicBase.replace(/\/+$/, '');
    return row.webhookToken
      ? `${base}/webhook/chowdeck/${row.webhookToken}`
      : `${base}/webhook/chowdeck`;
  }

  async testConnection(businessId: string, storeId: string, channelId?: string) {
    const integration = await this.requireIntegration(
      businessId,
      storeId,
      channelId,
    );
    const result = await this.client.ping(this.credentialsOf(integration));
    return { ok: true, ...result };
  }

  /**
   * Resolves one channel. With no `channelId` the store's only channel is used;
   * if it has several the caller must say which, rather than us silently
   * picking one and publishing a menu to the wrong Chowdeck vendor.
   */
  /** Public alias used by the controller's test-order action. */
  async requireChannel(
    businessId: string,
    storeId: string,
    channelId?: string,
  ): Promise<ChowdeckIntegrationEntity> {
    return this.requireIntegration(businessId, storeId, channelId);
  }

  private async requireIntegration(
    businessId: string,
    storeId: string,
    channelId?: string,
  ): Promise<ChowdeckIntegrationEntity> {
    if (channelId) {
      const one = await this.findWithSecret({ id: channelId });
      if (!one || one.businessId !== businessId || one.storeId !== storeId) {
        throw new NotFoundException('Chowdeck channel not found on this store');
      }
      return one;
    }
    const rows = await this.integrationRepo.find({
      where: { businessId, storeId },
      select: { id: true },
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException('This store is not connected to Chowdeck');
    }
    if (rows.length > 1) {
      throw new BadRequestException(
        'This store has several Chowdeck channels — specify which one.',
      );
    }
    const only = await this.findWithSecret({ id: rows[0].id });
    if (!only) throw new NotFoundException('This store is not connected to Chowdeck');
    return only;
  }

  // ───────────────────────── menu sync ─────────────────────────

  /**
   * Publishes the store's whole menu to Chowdeck and rebuilds the id map.
   *
   * **`/menu/bulk-upload` REPLACES the merchant's entire Chowdeck menu with the
   * payload** — verified against the live sandbox: uploading one item left that
   * merchant holding exactly one item, and the fifteen that were there before
   * were gone. It is not the "create" the docs imply.
   *
   * So the whole catalogue goes in one call, every time. An earlier design
   * split items into create-vs-update batches based on what Chowdeck already
   * held; that was actively dangerous — the upload half wiped the menu and the
   * update half then failed with "Menu not found" against rows it had just
   * destroyed. Sending everything at once is both simpler and the only
   * non-destructive shape available.
   *
   * The id map still has to be read back afterwards: the upload only echoes the
   * references it accepted, while order webhooks quote Chowdeck's numeric menu
   * id, and `GET /menu` is the only place both appear.
   */
  async syncMenu(businessId: string, storeId: string, channelId?: string) {
    const integration = await this.requireIntegration(
      businessId,
      storeId,
      channelId,
    );
    const creds = this.credentialsOf(integration);

    const products = await this.productRepo.find({
      where: { storeId, status: true },
      relations: ['variations', 'addonGroups', 'addonGroups.addons'],
    });
    if (products.length === 0) {
      throw new BadRequestException(
        'This store has no active products to publish to Chowdeck',
      );
    }

    const categoryIds = Array.from(
      new Set(products.map((p) => p.categoryId).filter((id): id is string => !!id)),
    );
    const categories = categoryIds.length
      ? await this.categoryRepo.find({ where: { id: In(categoryIds) } })
      : [];
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const items = products.map((product) => {
      const category = product.categoryId
        ? categoryById.get(product.categoryId)
        : undefined;
      return {
        reference: product.id,
        name: product.name,
        description: product.description ?? product.name,
        price: toKobo(Number(product.sellingPrice ?? product.price ?? 0)),
        in_stock: product.status !== false && (product.stock ?? 0) !== 0,
        images: product.imageUrl ? [{ path: product.imageUrl }] : [],
        category: {
          name: category?.name ?? 'Menu',
          reference: category?.id ?? 'default',
          rank: category?.order ?? 0,
        },
        modifiers: this.buildModifiers(product),
      };
    });

    // What Chowdeck holds *before* this publish, purely so the merchant can be
    // told what the replace removed.
    const live = await this.client.listMenu(creds);
    const liveReferences = new Set(
      (live ?? []).map((m) => m.reference).filter((r): r is string => !!r),
    );
    const ourReferences = new Set(items.map((i) => i.reference));
    const replaced = (live ?? [])
      .filter((m) => !m.reference || !ourReferences.has(m.reference))
      .map((m) => m.name)
      .filter((n): n is string => !!n);

    // One call with the complete menu — see the note above: this replaces
    // whatever was there.
    const accepted = await this.client.bulkUploadMenu(creds, items);
    const publishedCount = Array.isArray(accepted) ? accepted.length : items.length;
    const created = items.filter((i) => !liveReferences.has(i.reference)).length;
    const updated = publishedCount - created > 0 ? publishedCount - created : 0;
    const updateFailures: string[] = [];

    const map = await this.rebuildMenuMap(integration, creds);

    integration.lastMenuSyncAt = new Date();
    await this.integrationRepo.update(
      { id: integration.id },
      { lastMenuSyncAt: integration.lastMenuSyncAt },
    );

    return {
      published: items.length,
      /**
       * Items that were on the Chowdeck menu before this publish and are not in
       * our catalogue — the replace removed them. Surfaced so a merchant can
       * see immediately if they have just wiped something.
       */
      replacedItems: replaced,
      created,
      updated,
      updateFailures,
      mapped: map.mapped,
      unmapped: map.unmapped,
    };
  }

  /** Variations and add-on groups both become Chowdeck "modifiers". */
  private buildModifiers(product: ProductEntity) {
    const modifiers: unknown[] = [];

    if (product.variations?.length) {
      modifiers.push({
        name: 'Options',
        minimum_selection: 1,
        maximum_selection: 1,
        items: product.variations.map((v) => ({
          name: v.name,
          price: toKobo(Number(v.sellingPrice ?? v.price ?? 0)),
          reference: v.id,
        })),
      });
    }

    for (const group of product.addonGroups ?? []) {
      const options = (group.addons ?? []).filter((a) => a.isAvailable !== false);
      if (options.length === 0) continue;
      modifiers.push({
        name: group.name,
        minimum_selection: group.minSelection ?? 0,
        maximum_selection: group.maxSelection ?? options.length,
        items: options.map((a) => ({
          name: a.name,
          price: toKobo(Number(a.price ?? 0)),
          reference: a.id,
        })),
      });
    }

    return modifiers;
  }

  /**
   * Reads Chowdeck's live menu and stores `chowdeckMenuId ↔ productId` for
   * every entry whose `reference` is one of our product ids. Entries created
   * directly in Chowdeck's dashboard (no reference, or an unknown one) are
   * reported as unmapped rather than guessed at.
   */
  async rebuildMenuMap(
    integration: ChowdeckIntegrationEntity,
    creds: ChowdeckCredentials,
  ) {
    const storeId = integration.storeId;
    const menu = await this.client.listMenu(creds);
    const ourProductIds = new Set(
      (await this.productRepo.find({ where: { storeId }, select: { id: true } })).map(
        (p) => p.id,
      ),
    );

    let mapped = 0;
    const unmapped: string[] = [];
    for (const entry of menu ?? []) {
      const reference = entry.reference ?? '';
      if (!reference || !ourProductIds.has(reference)) {
        unmapped.push(entry.name);
        continue;
      }
      await this.menuMapRepo.upsert(
        {
          storeId,
          integrationId: integration.id,
          productId: reference,
          chowdeckMenuId: String(entry.id),
          name: entry.name,
        },
        ['integrationId', 'productId'],
      );
      mapped += 1;
    }
    return { mapped, unmapped };
  }

  /**
   * productId for a Chowdeck menu id, or null when unmapped. Scoped to the
   * channel that received the order: the same product carries a different
   * numeric id on each Chowdeck vendor listing.
   */
  async productIdForMenuId(
    integrationId: string,
    chowdeckMenuId: string | number,
  ): Promise<string | null> {
    const row = await this.menuMapRepo.findOne({
      where: { integrationId, chowdeckMenuId: String(chowdeckMenuId) },
    });
    return row?.productId ?? null;
  }

  /** A few products already mapped on this channel, for the test order. */
  async mappedMenuItems(integrationId: string, limit = 2) {
    return this.menuMapRepo.find({
      where: { integrationId },
      take: limit,
      order: { createdAt: 'ASC' },
    });
  }

  // ───────────────────────── outbound status sync ─────────────────────────

  /**
   * The Chowdeck calls a local status transition implies, per the client's
   * spec:
   *
   *   accept  — the moment staff take the order on (leaving INITIATED)
   *   ready   — when it's packed and waiting for the rider
   *   reject  — when it's cancelled
   *   preparing — deliberately nothing; Chowdeck has no such state
   *
   * Completion is driven the other way: Chowdeck's ORDER_COMPLETE webhook
   * tells us the customer received it.
   */
  static actionsFor(
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
  ): Array<'accept' | 'ready' | 'reject'> {
    const actions: Array<'accept' | 'ready' | 'reject'> = [];
    if (toStatus === OrderStatus.CANCELLED) return ['reject'];

    const acceptedNow =
      fromStatus === OrderStatus.INITIATED && toStatus !== OrderStatus.INITIATED;
    if (acceptedNow) actions.push('accept');
    if (toStatus === OrderStatus.READY) actions.push('ready');
    return actions;
  }

  /**
   * Best-effort push of a local status change to Chowdeck.
   *
   * Never throws: a third party being unreachable must not roll back or block
   * the merchant's own order flow. Failures are logged with the reference so
   * they can be replayed by hand.
   */
  async pushStatus(params: {
    storeId: string;
    externalReference: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    reason?: string | null;
  }): Promise<void> {
    const actions = ChowdeckService.actionsFor(params.fromStatus, params.toStatus);
    if (actions.length === 0) return;

    const integration = await this.findWithSecret({ storeId: params.storeId });
    if (!integration?.isEnabled) return;
    const creds = this.credentialsOf(integration);

    for (const action of actions) {
      try {
        if (action === 'accept') {
          await this.client.acceptOrder(creds, params.externalReference);
        } else if (action === 'ready') {
          await this.client.readyOrder(creds, params.externalReference);
        } else {
          await this.client.rejectOrder(
            creds,
            params.externalReference,
            params.reason ?? 'Unable to fulfil this order',
          );
        }
        this.logger.log(
          `Chowdeck ${action} sent for order ${params.externalReference}`,
        );
      } catch (err) {
        const detail =
          err instanceof ChowdeckApiError
            ? `${err.httpStatus} ${err.message}`
            : (err as Error).message;
        this.logger.warn(
          `Chowdeck ${action} failed for order ${params.externalReference}: ${detail}`,
        );
      }
    }
  }
}
