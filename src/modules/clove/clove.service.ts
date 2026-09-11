import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloveIntegrationEntity } from './entities/clove-integration.entity';
import { CloveMenuItemEntity } from './entities/clove-menu-item.entity';
import { UpsertCloveIntegrationDto } from './dto/clove-integration.dto';
import {
  CloveClient,
  CloveCredentials,
  CloveProductInput,
  CloveVariantInput,
} from './clove.client';
import { ProductEntity } from '../products/entities/product.entity';
import { StoreEntity } from '../store/entities/store.entity';

const SECRET_COLUMNS = {
  id: true,
  businessId: true,
  storeId: true,
  label: true,
  cloveStoreId: true,
  apiKey: true,
  baseUrl: true,
  isEnabled: true,
  autoAccept: true,
} as const;

@Injectable()
export class CloveService {
  private readonly logger = new Logger(CloveService.name);

  constructor(
    @InjectRepository(CloveIntegrationEntity)
    private readonly integrationRepo: Repository<CloveIntegrationEntity>,
    @InjectRepository(CloveMenuItemEntity)
    private readonly menuMapRepo: Repository<CloveMenuItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly client: CloveClient,
  ) {}

  // ───────────────────────── configuration ─────────────────────────

  async findWithSecret(
    where: Partial<Pick<CloveIntegrationEntity, 'id' | 'storeId'>>,
  ): Promise<CloveIntegrationEntity | null> {
    return this.integrationRepo.findOne({ where, select: { ...SECRET_COLUMNS } });
  }

  /** Every enabled channel, with secrets — used by the order pull. */
  async listEnabledWithSecrets(): Promise<CloveIntegrationEntity[]> {
    return this.integrationRepo.find({
      where: { isEnabled: true },
      select: { ...SECRET_COLUMNS },
    });
  }

  credentialsOf(integration: CloveIntegrationEntity): CloveCredentials {
    return { apiKey: integration.apiKey, baseUrl: integration.baseUrl };
  }

  /** Safe view for the hub: the key is masked, never returned raw. */
  private present(integration: CloveIntegrationEntity, apiKey?: string) {
    return {
      id: integration.id,
      storeId: integration.storeId,
      label: integration.label ?? null,
      cloveStoreId: integration.cloveStoreId ?? null,
      baseUrl: integration.baseUrl,
      isEnabled: integration.isEnabled,
      autoAccept: integration.autoAccept,
      apiKeyPreview: apiKey
        ? `${apiKey.slice(0, 11)}…${apiKey.slice(-4)}`
        : null,
      lastMenuSyncAt: integration.lastMenuSyncAt ?? null,
      lastOrderSyncAt: integration.lastOrderSyncAt ?? null,
    };
  }

  async listChannels(businessId: string, storeId: string) {
    const rows = await this.integrationRepo.find({
      where: { businessId, storeId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      rows.map(async (r) => {
        const withSecret = await this.findWithSecret({ id: r.id });
        return this.present(r, withSecret?.apiKey);
      }),
    );
  }

  async upsertConfig(
    businessId: string,
    storeId: string,
    dto: UpsertCloveIntegrationDto,
    channelId?: string,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store || store.businessId !== businessId) {
      throw new NotFoundException('Store not found');
    }

    // With no channelId this is the legacy single-config save. It must UPDATE
    // the store's only channel, not silently create a second one — otherwise
    // every save from the old form spawned another Cloove connection.
    // Creating is reserved for a store that has none, or an explicit "add".
    let existing = channelId ? await this.findWithSecret({ id: channelId }) : null;
    if (!channelId && !dto.createNew) {
      const rows = await this.integrationRepo.find({
        where: { businessId, storeId },
        select: { id: true },
        order: { createdAt: 'ASC' },
      });
      if (rows.length === 1) {
        existing = await this.findWithSecret({ id: rows[0].id });
      } else if (rows.length > 1) {
        throw new BadRequestException(
          'This store has several Cloove channels — choose which one to edit, ' +
            'or use "Add channel" to connect another.',
        );
      }
    }
    if (channelId && (!existing || existing.storeId !== storeId)) {
      throw new NotFoundException('Cloove channel not found on this store');
    }
    if (!existing && !dto.apiKey) {
      throw new BadRequestException(
        'A Cloove API key is required the first time you connect a channel',
      );
    }

    const entity = existing ?? this.integrationRepo.create({ businessId, storeId });
    entity.businessId = businessId;
    entity.storeId = storeId;
    if (dto.label !== undefined) entity.label = dto.label?.trim() || null;
    if (dto.cloveStoreId !== undefined) {
      entity.cloveStoreId = dto.cloveStoreId?.trim() || null;
    }
    // Omitting the key on an update keeps the stored one — the hub only ever
    // sees a masked preview, so it cannot echo the real value back.
    if (dto.apiKey) {
      const key = dto.apiKey.trim();
      // Cloove issues two keys and they look almost identical. The publishable
      // one is rejected by every API call, which previously only showed up
      // later as a failed "Test connection" — say so at the point of entry.
      if (/^clv_(live|test)_pk_/i.test(key)) {
        throw new BadRequestException(
          'That is a publishable key (clv_…_pk_…), which the Cloove API rejects. ' +
            'Use the secret key (clv_…_sk_…) from your Cloove dashboard.',
        );
      }
      entity.apiKey = key;
    }
    if (dto.baseUrl !== undefined) {
      entity.baseUrl = dto.baseUrl?.trim() || 'https://api.clooveai.com';
    }
    if (dto.isEnabled !== undefined) entity.isEnabled = dto.isEnabled;
    if (dto.autoAccept !== undefined) entity.autoAccept = dto.autoAccept;

    const saved = await this.integrationRepo.save(entity);
    return this.present(saved, entity.apiKey);
  }

  async removeConfig(businessId: string, storeId: string, channelId?: string) {
    const existing = await this.requireChannel(businessId, storeId, channelId);
    await this.menuMapRepo.delete({ integrationId: existing.id });
    await this.integrationRepo.delete({ id: existing.id });
  }

  async requireChannel(
    businessId: string,
    storeId: string,
    channelId?: string,
  ): Promise<CloveIntegrationEntity> {
    if (channelId) {
      const one = await this.findWithSecret({ id: channelId });
      if (!one || one.businessId !== businessId || one.storeId !== storeId) {
        throw new NotFoundException('Cloove channel not found on this store');
      }
      return one;
    }
    const rows = await this.integrationRepo.find({
      where: { businessId, storeId },
      select: { id: true },
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException('This store is not connected to Cloove');
    }
    if (rows.length > 1) {
      throw new BadRequestException(
        'This store has several Cloove channels — specify which one.',
      );
    }
    const only = await this.findWithSecret({ id: rows[0].id });
    if (!only) throw new NotFoundException('This store is not connected to Cloove');
    return only;
  }

  async testConnection(businessId: string, storeId: string, channelId?: string) {
    const integration = await this.requireChannel(businessId, storeId, channelId);
    const result = await this.client.ping(this.credentialsOf(integration));
    return { ok: true, ...result };
  }

  // ───────────────────────── menu sync ─────────────────────────

  /**
   * Publishes this store's active products to Cloove and keeps the id map.
   *
   * Cloove has no external-reference field, so "have I published this already?"
   * is answered by our own map rather than by anything Cloove echoes back —
   * mapped products are PATCHed in place, unmapped ones are created. That makes
   * a second publish a correction rather than a duplicate catalogue.
   */
  async syncMenu(businessId: string, storeId: string, channelId?: string) {
    const integration = await this.requireChannel(businessId, storeId, channelId);
    const creds = this.credentialsOf(integration);

    const products = await this.productRepo.find({
      where: { storeId, status: true },
      relations: ['variations'],
    });
    if (products.length === 0) {
      throw new BadRequestException(
        'This store has no active products to publish to Cloove',
      );
    }

    /**
     * Never publish an unpriced product. `price` is the cost price and
     * `sellingPrice` the customer-facing one, and `sellingPrice` defaults to 0
     * rather than null — so an unpriced item would be listed free rather than
     * simply omitted.
     */
    const priced = products.filter((p) => Number(p.sellingPrice) > 0);
    const skippedNoPrice = products
      .filter((p) => Number(p.sellingPrice) <= 0)
      .map((p) => p.name);
    if (priced.length === 0) {
      throw new BadRequestException(
        "None of this store's active products have a selling price set, so " +
          'there is nothing that can safely be published to Cloove.',
      );
    }

    const existingMap = await this.menuMapRepo.find({
      where: { integrationId: integration.id },
    });
    const cloveIdByProduct = new Map(
      existingMap.map((m) => [m.productId, m.cloveProductId]),
    );

    let created = 0;
    let updated = 0;
    let adopted = 0;
    const failures: string[] = [];

    /**
     * Adopt products that already exist on Cloove.
     *
     * Cloove has no external-reference field, so the only record that a
     * product is already published is our own map — and that map is empty for
     * anything the merchant built in Cloove directly, or published before this
     * integration existed. Creating blindly then means asking Cloove to add a
     * product it already has, which it refuses because product names are
     * unique per business. That is exactly what produced a publish reporting
     * "22 failed" against a catalogue that overlapped an existing Cloove menu.
     *
     * Matching on the normalised name is the only join available (there is no
     * shared identifier), so an existing entry is adopted into the map and
     * PATCHed in place instead of being duplicated.
     */
    const normalise = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const unmapped = priced.filter((p) => !cloveIdByProduct.has(p.id));
    if (unmapped.length > 0) {
      try {
        const remote = await this.client.listAllProducts(creds);
        const remoteByName = new Map<string, string>();
        for (const r of remote) {
          if (r?.name && r?.id) remoteByName.set(normalise(r.name), r.id);
        }
        for (const product of unmapped) {
          const match = remoteByName.get(normalise(product.name));
          if (!match) continue;
          cloveIdByProduct.set(product.id, match);
          await this.rememberMapping(integration, product.id, match, product.name);
          adopted += 1;
        }
      } catch (err) {
        // A failed reconciliation must not stop the publish — it only means
        // we fall back to the previous create-blindly behaviour.
        this.logger.warn(
          `Cloove catalogue reconciliation failed: ${(err as Error).message}`,
        );
      }
    }

    for (const product of priced) {
      const input = this.buildProductInput(product);
      const knownCloveId = cloveIdByProduct.get(product.id);
      try {
        if (knownCloveId) {
          const res = await this.client.updateProduct(creds, knownCloveId, input);
          updated += 1;
          await this.rememberMapping(integration, product.id, res.id, res.name);
        } else {
          const res = await this.client.createProduct(creds, input);
          created += 1;
          await this.rememberMapping(integration, product.id, res.id, res.name);
        }
      } catch (err) {
        failures.push(`${product.name}: ${(err as Error).message}`);
      }
    }

    integration.lastMenuSyncAt = new Date();
    await this.integrationRepo.update(
      { id: integration.id },
      { lastMenuSyncAt: integration.lastMenuSyncAt },
    );

    return {
      published: priced.length,
      /** Active products held back because they have no selling price. */
      skippedNoPrice,
      created,
      updated,
      /** Products already on Cloove that this publish claimed and updated. */
      adopted,
      failures,
      mapped: await this.menuMapRepo.count({
        where: { integrationId: integration.id },
      }),
    };
  }

  /** Publishes exactly one product — the "post one product" smoke test. */
  async syncOneProduct(
    businessId: string,
    storeId: string,
    productId: string,
    channelId?: string,
  ) {
    const integration = await this.requireChannel(businessId, storeId, channelId);
    const creds = this.credentialsOf(integration);
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['variations'],
    });
    if (!product || product.storeId !== storeId) {
      throw new NotFoundException('Product not found in this store');
    }

    const input = this.buildProductInput(product);
    const known = await this.menuMapRepo.findOne({
      where: { integrationId: integration.id, productId },
    });
    const res = known
      ? await this.client.updateProduct(creds, known.cloveProductId, input)
      : await this.client.createProduct(creds, input);
    await this.rememberMapping(integration, product.id, res.id, res.name);

    return {
      action: known ? 'updated' : 'created',
      productId: product.id,
      productName: product.name,
      cloveProductId: res.id,
      basePrice: res.basePrice,
      variants: (res.variants ?? []).map((v) => ({
        name: v.name,
        price: v.price,
        sku: v.sku,
      })),
    };
  }

  /**
   * Our product as Cloove expects it. Variations become Cloove **variants** —
   * `productOptions` is silently discarded by their API, variants are not, so
   * variants are the only shape that actually carries per-size pricing across.
   */
  private buildProductInput(product: ProductEntity): CloveProductInput {
    const variants: CloveVariantInput[] = (product.variations ?? []).map((v) => ({
      name: v.name,
      // Cloove takes naira decimals, not kobo.
      price: Number(v.sellingPrice),
      ...(v.sku ? { sku: v.sku } : {}),
    }));

    return {
      name: product.name,
      price: Number(product.sellingPrice),
      ...(product.description ? { description: product.description } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(variants.length ? { variants } : {}),
    };
  }

  private async rememberMapping(
    integration: CloveIntegrationEntity,
    productId: string,
    cloveProductId: string,
    name: string | null,
  ): Promise<void> {
    await this.menuMapRepo.upsert(
      {
        storeId: integration.storeId,
        integrationId: integration.id,
        productId,
        cloveProductId,
        name,
      },
      ['integrationId', 'productId'],
    );
  }

  /** productId for a Cloove product id, or null when unmapped. */
  async productIdForCloveId(
    integrationId: string,
    cloveProductId: string,
  ): Promise<string | null> {
    const row = await this.menuMapRepo.findOne({
      where: { integrationId, cloveProductId },
    });
    return row?.productId ?? null;
  }

  async mappedItems(integrationId: string, limit = 2) {
    return this.menuMapRepo.find({
      where: { integrationId },
      take: limit,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Relays a local status change back to Cloove.
   *
   * Cloove's order status vocabulary is only **pending / completed /
   * cancelled** (verified against the live API — everything else 422s as
   * "The selected status is invalid"). The client's spec asks for a push on
   * accept / preparing / ready / complete, but only three of those have any
   * Cloove equivalent, so:
   *   accepted (PENDING)          -> pending
   *   COMPLETED / SERVED          -> completed
   *   CANCELLED                   -> cancelled
   *   PREPARING / READY           -> nothing to send
   */
  private static cloveStatusFor(toStatus: string): string | null {
    switch (toStatus) {
      case 'pending':
        return 'pending';
      case 'completed':
      case 'served':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return null;
    }
  }

  async pushStatus(params: {
    storeId: string;
    externalReference: string;
    toStatus: string;
  }): Promise<void> {
    const cloveStatus = CloveService.cloveStatusFor(params.toStatus);
    if (!cloveStatus) return;

    // externalReference is stamped as `CLOVE-<cloveOrderId>`.
    const cloveOrderId = params.externalReference.replace(/^CLOVE-/, '');
    if (!cloveOrderId) return;

    const rows = await this.integrationRepo.find({
      where: { storeId: params.storeId, isEnabled: true },
      select: { id: true },
    });
    for (const row of rows) {
      const integration = await this.findWithSecret({ id: row.id });
      if (!integration) continue;
      try {
        await this.client.updateOrderStatus(
          this.credentialsOf(integration),
          cloveOrderId,
          cloveStatus,
        );
        this.logger.log(
          `Cloove status ${cloveStatus} sent for order ${cloveOrderId}`,
        );
        return;
      } catch (err) {
        this.logger.warn(
          `Cloove status push failed for ${cloveOrderId}: ${(err as Error).message}`,
        );
      }
    }
  }

  async markOrderSync(integrationId: string): Promise<void> {
    await this.integrationRepo.update(
      { id: integrationId },
      { lastOrderSyncAt: new Date() },
    );
  }
}
