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
      merchantReference: integration.merchantReference,
      baseUrl: integration.baseUrl,
      isEnabled: integration.isEnabled,
      autoAccept: integration.autoAccept,
      secretKeyPreview: secret ? `${secret.slice(0, 11)}…${secret.slice(-4)}` : null,
      lastMenuSyncAt: integration.lastMenuSyncAt ?? null,
      lastWebhookAt: integration.lastWebhookAt ?? null,
    };
  }

  async getConfig(businessId: string, storeId: string) {
    const row = await this.findWithSecret({ storeId });
    if (!row || row.businessId !== businessId) return null;
    const full = await this.integrationRepo.findOne({ where: { id: row.id } });
    return this.present(full ?? row, row.secretKey);
  }

  async upsertConfig(
    businessId: string,
    storeId: string,
    dto: UpsertChowdeckIntegrationDto,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store || store.businessId !== businessId) {
      throw new NotFoundException('Store not found');
    }

    const existing = await this.findWithSecret({ storeId });
    if (!existing && !dto.secretKey) {
      throw new BadRequestException(
        'A Chowdeck secret key is required the first time you connect a store',
      );
    }

    const entity = existing ?? this.integrationRepo.create({ businessId, storeId });
    entity.businessId = businessId;
    entity.storeId = storeId;
    if (dto.merchantReference !== undefined) {
      entity.merchantReference = dto.merchantReference.trim();
    }
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

  async removeConfig(businessId: string, storeId: string): Promise<void> {
    const existing = await this.findWithSecret({ storeId });
    if (!existing || existing.businessId !== businessId) {
      throw new NotFoundException('This store is not connected to Chowdeck');
    }
    await this.menuMapRepo.delete({ storeId });
    await this.integrationRepo.delete({ id: existing.id });
  }

  /** The URL the merchant pastes into Chowdeck's dashboard. */
  async webhookUrl(
    businessId: string,
    storeId: string,
    publicBase: string,
  ): Promise<string | null> {
    const row = await this.findWithSecret({ storeId });
    if (!row || row.businessId !== businessId) return null;
    const base = publicBase.replace(/\/+$/, '');
    return row.webhookToken
      ? `${base}/webhook/chowdeck/${row.webhookToken}`
      : `${base}/webhook/chowdeck`;
  }

  async testConnection(businessId: string, storeId: string) {
    const integration = await this.requireIntegration(businessId, storeId);
    const result = await this.client.ping(this.credentialsOf(integration));
    return { ok: true, ...result };
  }

  private async requireIntegration(
    businessId: string,
    storeId: string,
  ): Promise<ChowdeckIntegrationEntity> {
    const integration = await this.findWithSecret({ storeId });
    if (!integration || integration.businessId !== businessId) {
      throw new NotFoundException('This store is not connected to Chowdeck');
    }
    return integration;
  }

  // ───────────────────────── menu sync ─────────────────────────

  /**
   * Pushes the store's products to Chowdeck and rebuilds the id map.
   *
   * Two passes on purpose: the bulk upload is keyed by *our* reference (the
   * product id) and only echoes back the references it accepted, while order
   * webhooks quote Chowdeck's numeric menu id. Reading `GET /menu` afterwards
   * is the only way to learn that id, so the map is always derived from what
   * Chowdeck actually holds rather than from what we hoped it stored.
   */
  async syncMenu(businessId: string, storeId: string) {
    const integration = await this.requireIntegration(businessId, storeId);
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

    // Split by what Chowdeck already holds. Re-uploading an existing reference
    // has undefined semantics (their bulk-upload is documented as a create), so
    // known items go through bulk-update instead — that's what makes a second
    // publish a correction rather than a gamble.
    const live = await this.client.listMenu(creds);
    const liveReferences = new Set(
      (live ?? [])
        .map((m) => m.reference)
        .filter((r): r is string => !!r),
    );
    const toCreate = items.filter((i) => !liveReferences.has(i.reference));
    const toUpdate = items.filter((i) => liveReferences.has(i.reference));

    let created = 0;
    if (toCreate.length > 0) {
      const accepted = await this.client.bulkUploadMenu(creds, toCreate);
      created = Array.isArray(accepted) ? accepted.length : toCreate.length;
    }

    let updated = 0;
    const updateFailures: string[] = [];
    if (toUpdate.length > 0) {
      const result = await this.client.bulkUpdateMenu(
        creds,
        toUpdate.map((i) => ({
          reference: i.reference,
          name: i.name,
          description: i.description,
          price: i.price,
          in_stock: i.in_stock,
        })),
      );
      // Bulk update answers 200 even when individual rows fail, so the per-item
      // results are the only truthful signal.
      for (const row of result?.results ?? []) {
        if (row.status === 'success') updated += 1;
        else {
          const product = products.find((p) => p.id === row.reference);
          updateFailures.push(
            `${product?.name ?? row.reference}: ${row.message ?? 'failed'}`,
          );
        }
      }
    }

    const map = await this.rebuildMenuMap(storeId, creds);

    integration.lastMenuSyncAt = new Date();
    await this.integrationRepo.update(
      { id: integration.id },
      { lastMenuSyncAt: integration.lastMenuSyncAt },
    );

    return {
      published: items.length,
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
  async rebuildMenuMap(storeId: string, creds: ChowdeckCredentials) {
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
          productId: reference,
          chowdeckMenuId: String(entry.id),
          name: entry.name,
        },
        ['storeId', 'productId'],
      );
      mapped += 1;
    }
    return { mapped, unmapped };
  }

  /** productId for a Chowdeck menu id, or null when unmapped. */
  async productIdForMenuId(
    storeId: string,
    chowdeckMenuId: string | number,
  ): Promise<string | null> {
    const row = await this.menuMapRepo.findOne({
      where: { storeId, chowdeckMenuId: String(chowdeckMenuId) },
    });
    return row?.productId ?? null;
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
