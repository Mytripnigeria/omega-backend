import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CloveIntegrationEntity } from './entities/clove-integration.entity';
import { CloveMenuItemEntity } from './entities/clove-menu-item.entity';
import { UpsertCloveIntegrationDto } from './dto/clove-integration.dto';
import {
  CloveApiError,
  CloveCategory,
  CloveClient,
  CloveCredentials,
  CloveProduct,
  CloveProductInput,
  CloveVariantInput,
} from './clove.client';
import { ProductEntity } from '../products/entities/product.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { CategoryEntity } from '../categories/entities/category.entity';

/** The only join Cloove offers is the name, so compare them loosely. */
const normalise = (name: string): string =>
  (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Who holds a SKU: a size is identified by its own id, or its position. */
const variantKey = (
  product: { id: string },
  variation: { id?: string },
  index: number,
): string => `${product.id}#${variation.id ?? index}`;

/**
 * Runs `fn` over `items` with at most `limit` in flight. Cloove answers each
 * call in roughly 0.7 s; done one at a time, a 50-product publish took 40 s —
 * long enough to trip a proxy timeout behind a single button click.
 */
const mapPool = async <T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

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
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
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
   * Cloove is treated as a mirror of this store's menu, the way Chowdeck is:
   *   1. everything active and priced here is created or corrected there;
   *   2. anything there that is not on this menu is deleted.
   *
   * Cloove has no external-reference field, so "have I published this
   * already?" is answered by our own map rather than by anything Cloove echoes
   * back — mapped products are PATCHed in place, unmapped ones are created,
   * and anything the merchant built in Cloove under the same name is adopted
   * into the map instead of duplicated.
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
     * simply omitted. A product priced only through its sizes counts as priced.
     */
    const priced = products.filter((p) => CloveService.basePriceOf(p) > 0);
    const skippedNoPrice = products
      .filter((p) => CloveService.basePriceOf(p) <= 0)
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
    let removed = 0;
    const removedNames: string[] = [];
    const skuConflicts: string[] = [];
    const failures: string[] = [];

    const categories = await this.resolveCategories(creds, priced);

    /**
     * The catalogue as Cloove holds it right now. Adoption, pruning and
     * carrying variant ids across an update all lean on it. A failed read must
     * not stop the publish — it only means falling back to create-or-update
     * by map alone, with no pruning this time.
     */
    let remote: CloveProduct[] | null = null;
    try {
      remote = await this.client.listAllProducts(creds);
    } catch (err) {
      this.logger.warn(
        `Cloove catalogue read failed, publishing by map only: ${(err as Error).message}`,
      );
    }
    const remoteById = new Map((remote ?? []).map((r) => [r.id, r]));

    if (remote) {
      // A mapped product the merchant deleted on Cloove's side is gone for
      // good (their delete is soft; the id never comes back). Forget the row
      // so the product is adopted or re-created rather than PATCHed into a 404.
      for (const row of existingMap) {
        if (remoteById.has(row.cloveProductId)) continue;
        await this.menuMapRepo.delete({ id: row.id });
        cloveIdByProduct.delete(row.productId);
      }
    }

    /**
     * Adopt products that already exist on Cloove.
     *
     * Our map is empty for anything the merchant built in Cloove directly, or
     * published before this integration existed. Creating blindly then means
     * asking Cloove to add a product it already has, which it refuses because
     * product names are unique per business. That is exactly what produced a
     * publish reporting "22 failed" against a catalogue that overlapped an
     * existing Cloove menu.
     *
     * Matching on the normalised name is the only join available (there is no
     * shared identifier). Every active product takes part, priced or not, so
     * an unpriced item that already exists on Cloove is recognised as ours and
     * left alone rather than pruned as a stranger.
     */
    if (remote) {
      const remoteByName = new Map<string, string>();
      for (const r of remote) {
        if (r?.name && r?.id && !r.isExtraOnly) {
          remoteByName.set(normalise(r.name), r.id);
        }
      }
      const claimed = new Set(cloveIdByProduct.values());
      for (const product of products) {
        if (cloveIdByProduct.has(product.id)) continue;
        const match = remoteByName.get(normalise(product.name));
        if (!match || claimed.has(match)) continue;
        cloveIdByProduct.set(product.id, match);
        claimed.add(match);
        await this.rememberMapping(integration, product.id, match, product.name);
        adopted += 1;
      }
    }

    /**
     * Prune: delete from Cloove whatever is not on this menu.
     *
     * This is the Chowdeck contract the merchant asked for ("just like
     * chowdeck, it should delete products that are not on our omega menu"),
     * and it is also what makes the publish fit at all: Cloove caps the
     * catalogue per plan (50 on this merchant's), so the strangers have to go
     * BEFORE the creates or every new product is refused with "You have
     * reached the product limit for your plan".
     *
     * Kept, in order of caution:
     *   - anything mapped to one of this store's active products;
     *   - anything mapped by a sibling channel that shares this API key — two
     *     of our stores publishing into one Cloove workspace must not delete
     *     each other's menu;
     *   - Cloove's extras-only items, which are modifiers hanging off other
     *     products rather than menu entries, and which nothing here replaces.
     */
    if (remote) {
      const keep = new Set<string>();
      for (const product of products) {
        const id = cloveIdByProduct.get(product.id);
        if (id) keep.add(id);
      }
      for (const id of await this.cloveIdsHeldBySiblings(integration)) keep.add(id);

      const strangers = remote.filter((r) => !keep.has(r.id) && !r.isExtraOnly);
      await mapPool(strangers, CloveService.CONCURRENCY, async (r) => {
        try {
          await this.client.deleteProduct(creds, r.id);
          removed += 1;
          removedNames.push(r.name);
          remoteById.delete(r.id);
          // Rows for products that have since been deactivated point here.
          await this.menuMapRepo.delete({
            integrationId: integration.id,
            cloveProductId: r.id,
          });
        } catch (err) {
          failures.push(`Remove ${r.name}: ${(err as Error).message}`);
        }
      });
    }

    /**
     * SKUs that would collide on Cloove.
     *
     * Cloove keeps SKUs unique per workspace and answers a collision with a
     * bare "An unexpected error occurred" — no field, no hint. This catalogue
     * reuses SKUs freely (a product and its Small variant share one; two
     * pizzas share three), which is what left 21 of 50 products failing on
     * every publish. A SKU is optional on Cloove, so each SKU is sent exactly
     * once — with its first holder in menu order — and left off any later
     * one. Where a product has sizes, the sizes are the holders: Cloove pins a
     * product-level SKU to the default variant, and a product with sizes has
     * no default variant to pin it to.
     */
    const skuOwner = new Map<string, string>();
    const claimSku = (sku: string | null | undefined, owner: string) => {
      if (sku && !skuOwner.has(sku)) skuOwner.set(sku, owner);
    };
    for (const product of priced) {
      const variations = product.variations ?? [];
      if (variations.length > 0) {
        variations.forEach((v, i) => claimSku(v.sku, variantKey(product, v, i)));
      } else {
        claimSku(product.sku, product.id);
      }
    }
    const owns = (sku: string, owner: string) => skuOwner.get(sku) === owner;

    const skusIn = (input: CloveProductInput): string[] =>
      [input.sku, ...(input.variants ?? []).map((v) => v.sku)].filter(
        (sku): sku is string => !!sku,
      );

    await mapPool(priced, CloveService.CONCURRENCY, async (product) => {
      const knownCloveId = cloveIdByProduct.get(product.id);
      const current = knownCloveId ? (remoteById.get(knownCloveId) ?? null) : null;
      const publish = async (input: CloveProductInput) => {
        if (knownCloveId) {
          const res = await this.client.updateProduct(creds, knownCloveId, input);
          updated += 1;
          await this.rememberMapping(integration, product.id, res.id, res.name);
        } else {
          const res = await this.client.createProduct(creds, input);
          created += 1;
          await this.rememberMapping(integration, product.id, res.id, res.name);
        }
      };
      const categoryId = categories.byProduct.get(product.id);
      const input = this.buildProductInput(product, { owns, current, categoryId });
      try {
        await publish(input);
        return;
      } catch (err) {
        /**
         * A SKU can also collide with something nothing here can see:
         * Cloove keeps the SKUs of soft-deleted products reserved (verified —
         * re-creating a deleted SKU is a bare 500), and a merchant who built
         * a product in Cloove may hold a SKU on a different item. Cloove
         * gives no reason, so when the input carried any SKU, try again with
         * only the SKUs already live on this very product, then with none.
         */
        const sent = skusIn(input);
        // Only Cloove's bare 500 is the collision signature. A 429, a 422 or a
        // 404 says something else, and dropping SKUs over it would throw away
        // SKUs for nothing — which is exactly what a rate-limited publish did.
        const skuCollision = err instanceof CloveApiError && err.upstreamStatus === 500;
        if (sent.length === 0 || !skuCollision) {
          failures.push(`${product.name}: ${(err as Error).message}`);
          return;
        }
        const seen = new Set<string>([sent.join('|')]);
        const fallbacks = [
          this.buildProductInput(product, { skus: 'current', current, categoryId }),
          this.buildProductInput(product, { skus: 'none', current, categoryId }),
        ].filter((alt) => {
          const key = skusIn(alt).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        let lastErr = err;
        for (const alt of fallbacks) {
          try {
            await publish(alt);
            const kept = skusIn(alt);
            const dropped = sent.filter((sku) => !kept.includes(sku));
            skuConflicts.push(`${product.name}: ${dropped.join(', ')}`);
            this.logger.warn(
              `Cloove accepted "${product.name}" only without ${dropped.join(', ')} — ` +
                `already held on Cloove (often by a deleted product).`,
            );
            return;
          } catch (retryErr) {
            lastErr = retryErr;
          }
        }
        failures.push(`${product.name}: ${(lastErr as Error).message}`);
      }
    });

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
      /** Cloove products deleted because they are not on this store's menu. */
      removed,
      removedNames,
      /**
       * SKUs Cloove refused, per product — published without them. Cloove
       * keeps a deleted product's SKU reserved, so this is usually "a product
       * with that SKU was deleted on Cloove"; the merchant can change the SKU
       * here or ask Cloove to purge it.
       */
      skuConflicts,
      /** Categories this publish had to add to Cloove to file products under. */
      categoriesCreated: categories.created,
      failures,
      mapped: await this.menuMapRepo.count({
        where: { integrationId: integration.id },
      }),
    };
  }

  /**
   * Cloove ids published by other channels on this business that use the
   * same key — the same Cloove workspace — and so are never ours to delete.
   */
  private async cloveIdsHeldBySiblings(
    integration: CloveIntegrationEntity,
  ): Promise<string[]> {
    const all = await this.integrationRepo.find({
      where: { businessId: integration.businessId },
      select: { ...SECRET_COLUMNS },
    });
    const siblings = all.filter(
      (s) => s.id !== integration.id && s.apiKey === integration.apiKey,
    );
    if (siblings.length === 0) return [];
    const rows = await this.menuMapRepo.find({
      where: { integrationId: In(siblings.map((s) => s.id)) },
    });
    return rows.map((r) => r.cloveProductId);
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

    const known = await this.menuMapRepo.findOne({
      where: { integrationId: integration.id, productId },
    });
    const current = known
      ? await this.client.getProduct(creds, known.cloveProductId)
      : null;
    const categories = await this.resolveCategories(creds, [product]);
    const input = this.buildProductInput(product, {
      current,
      categoryId: categories.byProduct.get(product.id),
    });
    const res = current
      ? await this.client.updateProduct(creds, current.id, input)
      : await this.client.createProduct(creds, input);
    await this.rememberMapping(integration, product.id, res.id, res.name);

    return {
      action: current ? 'updated' : 'created',
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
   * Cloove category for each product, by name.
   *
   * A product published without `category_id` sits under "General" on Cloove
   * — the client's "some categories are showing general instead of the
   * correct category". Cloove's categories are business-wide and carry no
   * external reference, and it happily creates duplicates, so the join is the
   * normalised name and anything missing is created exactly once. A failed
   * read must not stop the publish; the products simply keep their category.
   */
  private async resolveCategories(
    creds: CloveCredentials,
    products: ProductEntity[],
  ): Promise<{ byProduct: Map<string, string>; created: number }> {
    const byProduct = new Map<string, string>();
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))];
    if (categoryIds.length === 0) return { byProduct, created: 0 };

    const ours = await this.categoryRepo.find({ where: { id: In(categoryIds) } });
    const nameById = new Map(ours.map((c) => [c.id, c.name]));

    let remote: CloveCategory[];
    try {
      remote = await this.client.listCategories(creds);
    } catch (err) {
      this.logger.warn(`Cloove categories read failed: ${(err as Error).message}`);
      return { byProduct, created: 0 };
    }
    const cloveIdByName = new Map<string, string>();
    for (const c of remote) {
      if (c?.name && c?.id && !cloveIdByName.has(normalise(c.name))) {
        cloveIdByName.set(normalise(c.name), c.id);
      }
    }

    let created = 0;
    for (const product of products) {
      const name = product.categoryId ? nameById.get(product.categoryId) : undefined;
      if (!name?.trim()) continue;
      const key = normalise(name);
      if (!cloveIdByName.has(key)) {
        try {
          const made = await this.client.createCategory(creds, name.trim());
          cloveIdByName.set(key, made.id);
          created += 1;
        } catch (err) {
          this.logger.warn(
            `Cloove would not create category "${name}": ${(err as Error).message}`,
          );
          continue;
        }
      }
      byProduct.set(product.id, cloveIdByName.get(key)!);
    }
    return { byProduct, created };
  }

  /**
   * The price a product is listed at: the cheapest size when it is priced
   * through its sizes, otherwise its own selling price.
   */
  static basePriceOf(product: ProductEntity): number {
    const sizes = (product.variations ?? [])
      .map((v) => Number(v.sellingPrice))
      .filter((n) => n > 0);
    if (sizes.length > 0) return Math.min(...sizes);
    return Number(product.sellingPrice) || 0;
  }

  /**
   * Cloove calls in flight at once during a publish. Three keeps a 50-product
   * publish around ten seconds without bursting past the 120-per-window limit.
   */
  private static readonly CONCURRENCY = 3;

  /** Stock as a whole number Cloove will accept. */
  private static stockOf(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  /**
   * Our product as Cloove expects it — snake_case on the write side.
   *
   * Variations become Cloove **variants**, the only shape that carries
   * per-size pricing across, and keep their Cloove ids on an update so the
   * merchant's WhatsApp catalogue does not see every size replaced on each
   * publish. Stock and image go along: a product created without stock reads
   * as sold out on the Cloove bot, and this is what the merchant meant by
   * "it adds without image, sku, stock level".
   */
  private buildProductInput(
    product: ProductEntity,
    opts: {
      /**
       * Which SKUs to send: those this product holds (default); only those
       * already live on the product at Cloove; or none. The last two are the
       * retries after Cloove rejects a publish over a SKU it already has.
       */
      skus?: 'owned' | 'current' | 'none';
      owns?: (sku: string, owner: string) => boolean;
      /** The product as Cloove holds it now, when this is an update. */
      current?: CloveProduct | null;
      /** Cloove category to file it under; none leaves it where it is. */
      categoryId?: string;
    } = {},
  ): CloveProductInput {
    const owns = opts.owns ?? (() => true);
    const current = opts.current ?? null;
    const live = new Set(
      (current?.variants ?? []).map((v) => v.sku).filter((sku): sku is string => !!sku),
    );
    const keep = (sku: string | null | undefined, owner: string): sku is string => {
      if (!sku || opts.skus === 'none') return false;
      if (opts.skus === 'current') return live.has(sku);
      return owns(sku, owner);
    };
    const stock = CloveService.stockOf(product.stock);

    const currentVariantByName = new Map<string, string>();
    for (const v of current?.variants ?? []) {
      if (v.name) currentVariantByName.set(normalise(v.name), v.id);
    }
    const variants: CloveVariantInput[] = (product.variations ?? []).map((v, i) => {
      const id = currentVariantByName.get(normalise(v.name));
      return {
        ...(id ? { id } : {}),
        name: v.name,
        // Cloove takes naira decimals, not kobo.
        price: Number(v.sellingPrice),
        ...(keep(v.sku, variantKey(product, v, i)) ? { sku: v.sku } : {}),
        // A size with no stock of its own sells from the product's stock.
        stock_quantity: Number(v.stock) > 0 ? CloveService.stockOf(v.stock) : stock,
      };
    });

    const input: CloveProductInput = {
      name: product.name,
      price: CloveService.basePriceOf(product),
      is_active: true,
      ...(product.description ? { description: product.description } : {}),
      ...(product.imageUrl ? { image_urls: [product.imageUrl] } : {}),
      ...(opts.categoryId ? { category_id: opts.categoryId } : {}),
    };

    if (variants.length > 0) {
      input.variants = variants;
      return input;
    }

    if (keep(product.sku, product.id)) input.sku = product.sku;
    if (!current) {
      input.quantity = stock;
    } else if ((current.stores ?? []).length > 0) {
      // PATCH ignores `quantity`; stock on an existing product moves per store.
      input.store_inventory = (current.stores ?? []).map((s) => ({
        store_id: s.id,
        stock_quantity: stock,
      }));
    } else if (current.variants?.[0]) {
      input.variants = [
        {
          id: current.variants[0].id,
          name: current.variants[0].name ?? 'Standard',
          price: input.price,
          ...(input.sku ? { sku: input.sku } : {}),
          stock_quantity: stock,
        },
      ];
    }
    return input;
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
