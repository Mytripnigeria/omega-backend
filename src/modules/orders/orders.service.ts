import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatusEventEntity } from './entities/order-status-event.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  CancelOrderDto,
  OrderFilterDto,
  RecordPaymentDto,
  UpdateOrderStatusDto,
  UpdatePrepStatusDto,
} from './dto/order-filter.dto';
import {
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CustomersService } from '../customers/customers.service';
import { CouponsService } from '../coupons/coupons.service';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from '../customers/entities/wallet-transaction.entity';
import { PaystackService } from '../paystack/paystack.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';
import { TransactionMethod } from '../financial-transactions/entities/financial-transaction.entity';
import { MerchantWalletService } from '../merchant-wallet/merchant-wallet.service';
import { TableEntity, TableStatus } from '../tables/entities/table.entity';
import { PushService } from '../push-notifications/push.service';
import { ChowdeckService } from '../chowdeck/chowdeck.service';
import { CLOVE_SEND_TO_KITCHEN, CloveService } from '../clove/clove.service';
import { ProductIngredientEntity } from '../products/entities/product-ingredient.entity';
import { ProductVariationEntity } from '../products/entities/product-variation.entity';
import { ComboItemEntity } from '../combos/entities/combo-item.entity';
import { AddonIngredientEntity } from '../addon-groups/entities/addon-ingredient.entity';
import { DeliveryRegionEntity } from '../delivery-regions/entities/delivery-region.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { StoreLinksService } from '../store-links/store-links.service';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import {
  IngredientMovementEntity,
  MovementType,
} from '../ingredients/entities/ingredient-movement.entity';
import { IngredientLocationStockEntity } from '../ingredients/entities/ingredient-location-stock.entity';
import { InventoryLocationType } from '../inventory-locations/entities/inventory-location.entity';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import {
  DeliveryEntity,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';
import { computeEstimatedPrepMinutes } from './prep-time.util';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // INITIATED is the new entry state for every channel. A cashier Accepts
  // (-> PENDING) or Rejects (-> CANCELLED). "Quick Bill" jumps straight to
  // READY (skips the kitchen). PREPARING is allowed too so auto-accept can
  // flow directly into the kitchen.
  [OrderStatus.INITIATED]: [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.CANCELLED,
  ],
  // PENDING -> READY supports "Quick Bill" (skip the kitchen for ready-made
  // items); -> PREPARING is the standard "Process Bill" kitchen flow.
  [OrderStatus.PENDING]: [
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  // READY -> DELIVERING (delivery, after a rider self-assigns), SERVED/COMPLETED
  // (dine-in & takeaway). SERVED is retained for backwards compatibility.
  [OrderStatus.READY]: [
    OrderStatus.DELIVERING,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  // SERVED → PREPARING supports the kitchen "Recall" of a recently-completed
  // order back onto the board.
  [OrderStatus.SERVED]: [
    OrderStatus.PREPARING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
  // COMPLETED → PREPARING keeps the kitchen's "Recall" working now that the
  // kitchen finishes an order as COMPLETED rather than SERVED. Re-completing is
  // safe: ingredient consumption and cash settlement are both idempotent.
  [OrderStatus.COMPLETED]: [OrderStatus.PREPARING],
  [OrderStatus.CANCELLED]: [],
};

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

/**
 * One unit of work the kitchen actually makes, after combos have been expanded
 * into their member products. `variationName` is kept alongside `variationId`
 * so a line whose snapshot named the variation but omitted its id can be
 * resolved on its own, without borrowing another line's variation.
 */
interface ExpandedOrderLine {
  productId: string;
  variationId: string | null;
  variationName: string | null;
  units: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusEventEntity)
    private readonly eventRepo: Repository<OrderStatusEventEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(ProductIngredientEntity)
    private readonly productIngredientRepo: Repository<ProductIngredientEntity>,
    @InjectRepository(DeliveryRegionEntity)
    private readonly deliveryRegionRepo: Repository<DeliveryRegionEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(DeliveryEntity)
    private readonly deliveryRepo: Repository<DeliveryEntity>,
    @InjectRepository(WorkstationSettingsEntity)
    private readonly workstationSettingsRepo: Repository<WorkstationSettingsEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly customersService: CustomersService,
    private readonly ledger: FinancialTransactionsService,
    private readonly coupons: CouponsService,
    private readonly paystack: PaystackService,
    private readonly integrations: IntegrationsService,
    private readonly merchantWallet: MerchantWalletService,
    private readonly pushService: PushService,
    // forwardRef: ChowdeckModule creates orders through this service, so the
    // two modules reference each other.
    @Inject(forwardRef(() => ChowdeckService))
    private readonly chowdeck: ChowdeckService,
    @Inject(forwardRef(() => CloveService))
    private readonly clove: CloveService,
    private readonly storeLinks: StoreLinksService,
  ) {}

  /**
   * Reads the variation id an order item was snapshotted with. The jsonb
   * snapshot has drifted across clients over time (`variationId`, `id`,
   * `optionId`), so accept any of them; a name-only snapshot is resolved by
   * the caller against the product's variation list.
   */
  private static variationIdOf(
    variation: Record<string, unknown> | null,
  ): string | null {
    if (!variation) return null;
    for (const key of ['variationId', 'id', 'optionId']) {
      const v = variation[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    // The shape the POS and storefront actually send is
    // `{ name, selections: [{ id, name }] }` — the id lives inside the first
    // selection, not at the top level. Missing this meant variation-scoped
    // recipes never resolved by id and fell back to matching on name, which
    // mis-assigned the recipe when one order held two sizes of the same
    // product (a Big + a Small shawarma deducted two Big recipes).
    const selections = variation['selections'];
    if (Array.isArray(selections)) {
      for (const sel of selections) {
        if (!sel || typeof sel !== 'object') continue;
        const id = (sel as Record<string, unknown>)['id'];
        if (typeof id === 'string' && id.length > 0) return id;
      }
    }
    return null;
  }

  /** The variation's display name, used to resolve legacy id-less snapshots. */
  private static variationNameOf(
    variation: Record<string, unknown> | null,
  ): string | null {
    if (!variation) return null;
    const name = variation['name'];
    if (typeof name === 'string' && name.trim()) return name.trim();
    const selections = variation['selections'];
    if (Array.isArray(selections)) {
      for (const sel of selections) {
        if (!sel || typeof sel !== 'object') continue;
        const n = (sel as Record<string, unknown>)['name'];
        if (typeof n === 'string' && n.trim()) return n.trim();
      }
    }
    return null;
  }

  /** Same tolerance for add-on snapshots (`addonId`, `id`, `addOnId`). */
  private static addonIdOf(addon: Record<string, unknown>): string | null {
    for (const key of ['addonId', 'id', 'addOnId']) {
      const v = addon[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  }

  /**
   * Expands every order item into the flat list of {productId, variationId,
   * units} the kitchen actually makes, so recipes can be resolved uniformly:
   *
   *  - a plain product line contributes itself × quantity;
   *  - a COMBO line contributes each of its member products × comboItem.quantity
   *    × line quantity, so a combo deducts the inventory of each item as set on
   *    that item's own product (client spec);
   *  - the variation the customer picked rides along so variation-scoped
   *    recipes win over the product-level default.
   */
  private async expandOrderItemsToProducts(
    m: import('typeorm').EntityManager,
    items: OrderItemEntity[],
  ): Promise<ExpandedOrderLine[]> {
    const out: ExpandedOrderLine[] = [];

    const comboIds = Array.from(
      new Set(items.map((i) => i.comboId).filter((id): id is string => !!id)),
    );
    const comboItemsByCombo = new Map<string, ComboItemEntity[]>();
    if (comboIds.length > 0) {
      const comboItems = await m.getRepository(ComboItemEntity).find({
        where: { comboId: In(comboIds) },
      });
      for (const ci of comboItems) {
        const list = comboItemsByCombo.get(ci.comboId) ?? [];
        list.push(ci);
        comboItemsByCombo.set(ci.comboId, list);
      }
    }

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      if (item.comboId) {
        for (const ci of comboItemsByCombo.get(item.comboId) ?? []) {
          if (!ci.productId) continue;
          out.push({
            productId: ci.productId,
            // A combo bundles concrete products, not variations — always use
            // the member product's default recipe.
            variationId: null,
            variationName: null,
            units: qty * (Number(ci.quantity) || 1),
          });
        }
        continue;
      }

      if (!item.productId) continue;
      out.push({
        productId: item.productId,
        variationId: OrdersService.variationIdOf(item.variation),
        variationName: OrdersService.variationNameOf(item.variation),
        units: qty,
      });
    }

    return out;
  }

  /**
   * Deducts each order item's recipe ingredients from inventory and records
   * a CONSUMPTION movement per ingredient, so the merchant hub history view
   * shows what each completed order consumed. Deduction happens at the first
   * acceptance of the order (client spec: "deductions are instantly made" when
   * an order is taken on), with completion/payment as the fallback trigger for
   * orders that skipped acceptance — the ingredientsConsumedAt flag makes the
   * whole thing idempotent.
   *
   * Three sources of demand are summed (client spec, fifth feedback):
   *   1. products — combos expand into their member products first;
   *   2. variations — when the ordered variation has its own recipe rows those
   *      replace the product-level default entirely; products without a
   *      variation-scoped recipe fall back to the default rows;
   *   3. add-ons — each selected add-on option consumes its own recipe.
   *
   * If an ingredient has per-location stock rows, we debit the location
   * holding the most stock (best effort: orders don't carry a location
   * context). Callers must save the order in the same tx so the flag persists.
   */
  private async consumeIngredientsForOrder(
    m: import('typeorm').EntityManager,
    order: OrderEntity,
    actor: ActorContext,
  ): Promise<void> {
    if (order.ingredientsConsumedAt) return;
    order.ingredientsConsumedAt = new Date();
    const items = await m.getRepository(OrderItemEntity).find({
      where: { orderId: order.id },
    });
    if (items.length === 0) return;

    const required = new Map<string, number>();
    const add = (ingredientId: string, need: number) => {
      if (!(need > 0)) return;
      required.set(ingredientId, (required.get(ingredientId) ?? 0) + need);
    };

    // ---- 1 & 2. products (combos expanded) with variation-aware recipes ----
    const expanded = await this.expandOrderItemsToProducts(m, items);
    const productIds = Array.from(new Set(expanded.map((e) => e.productId)));

    if (productIds.length > 0) {
      const recipes = await m.getRepository(ProductIngredientEntity).find({
        where: { productId: In(productIds) },
      });

      // productId -> variationId ('' = product-level default) -> recipe rows
      const recipesByProduct = new Map<
        string,
        Map<string, ProductIngredientEntity[]>
      >();
      for (const r of recipes) {
        let byVariation = recipesByProduct.get(r.productId);
        if (!byVariation) {
          byVariation = new Map();
          recipesByProduct.set(r.productId, byVariation);
        }
        const key = r.variationId ?? '';
        const list = byVariation.get(key) ?? [];
        list.push(r);
        byVariation.set(key, list);
      }

      // Older snapshots carry the variation by name only. Resolve those to an
      // id *per line* — a blanket back-fill across every line of the product
      // made a Big + Small shawarma order deduct the Big recipe twice.
      const needsNameLookup = expanded.some(
        (e) => !e.variationId && e.variationName,
      );
      if (needsNameLookup) {
        const variations = await m.getRepository(ProductVariationEntity).find({
          where: { productId: In(productIds) },
        });
        for (const e of expanded) {
          if (e.variationId || !e.variationName) continue;
          const lowerName = e.variationName.toLowerCase();
          const match = variations.find(
            (v) =>
              v.productId === e.productId &&
              v.name.trim().toLowerCase() === lowerName,
          );
          if (match) e.variationId = match.id;
        }
      }

      for (const e of expanded) {
        const byVariation = recipesByProduct.get(e.productId);
        if (!byVariation) continue;
        // Product-level rows are the merchant's "All variants" lines, so they
        // apply to every variation; variation-scoped rows are what that one
        // variation additionally consumes. Previously the variation rows
        // *replaced* the product-level ones, so "All variants" ingredients were
        // never deducted for a product that also had per-variation recipes.
        const recipe = [
          ...(byVariation.get('') ?? []),
          ...((e.variationId ? byVariation.get(e.variationId) : undefined) ?? []),
        ];
        for (const r of recipe) add(r.ingredientId, e.units * Number(r.quantity));
      }
    }

    // ---- 3. add-ons ----
    const addonUnits = new Map<string, number>();
    // Snapshots that carry only a label. The POS used to persist add-ons as
    // `{name, price}` with no id, so their linked ingredients never resolved
    // and never left inventory. Resolve those by name against the *ordered
    // product's own* add-on groups — a business (even a single store) can hold
    // several add-ons sharing a name, so a catalogue-wide name match would
    // deduct every one of them.
    const unresolvedByProduct = new Map<string, Map<string, number>>();
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0 || !Array.isArray(item.addons)) continue;
      for (const a of item.addons) {
        if (!a || typeof a !== 'object') continue;
        const record = a as Record<string, unknown>;
        // An add-on may itself be ordered more than once on a single line.
        const perLine = Number(record['quantity']);
        const addonQty = Number.isFinite(perLine) && perLine > 0 ? perLine : 1;
        const units = qty * addonQty;

        const addonId = OrdersService.addonIdOf(record);
        if (addonId) {
          addonUnits.set(addonId, (addonUnits.get(addonId) ?? 0) + units);
          continue;
        }
        const name = record['name'];
        if (!item.productId || typeof name !== 'string' || !name.trim()) continue;
        const byName =
          unresolvedByProduct.get(item.productId) ?? new Map<string, number>();
        const key = name.trim().toLowerCase();
        byName.set(key, (byName.get(key) ?? 0) + units);
        unresolvedByProduct.set(item.productId, byName);
      }
    }
    if (unresolvedByProduct.size > 0) {
      const withAddons = await m.getRepository(ProductEntity).find({
        where: { id: In(Array.from(unresolvedByProduct.keys())) },
        relations: ['addonGroups', 'addonGroups.addons'],
      });
      for (const product of withAddons) {
        const byName = unresolvedByProduct.get(product.id);
        if (!byName) continue;
        for (const group of product.addonGroups ?? []) {
          for (const addon of group.addons ?? []) {
            const units = byName.get(addon.name.trim().toLowerCase());
            if (!units) continue;
            addonUnits.set(addon.id, (addonUnits.get(addon.id) ?? 0) + units);
            // Each snapshot line resolves once, even if two groups on the same
            // product happen to offer an add-on with the same name.
            byName.delete(addon.name.trim().toLowerCase());
          }
        }
      }
    }
    if (addonUnits.size > 0) {
      const addonRecipes = await m.getRepository(AddonIngredientEntity).find({
        where: { addOnId: In(Array.from(addonUnits.keys())) },
      });
      for (const r of addonRecipes) {
        const units = addonUnits.get(r.addOnId) ?? 0;
        add(r.ingredientId, units * Number(r.quantity));
      }
    }

    if (required.size === 0) return;

    const ingredientRepo = m.getRepository(IngredientEntity);
    const movementRepo = m.getRepository(IngredientMovementEntity);
    const locationStockRepo = m.getRepository(IngredientLocationStockEntity);

    for (const [ingredientId, need] of required) {
      const ing = await ingredientRepo.findOne({ where: { id: ingredientId } });
      if (!ing) continue;

      const previousStock = Number(ing.currentStock);
      const newStock = previousStock - need;

      // Deductions come from 'Out-Store' locations only (client spec: In-Store
      // holds bulk stock and merely transfers to Out-Store, which is what the
      // kitchen actually consumes). Among the out-store rows, debit the one
      // holding the most stock; orders don't bind to a specific location. If
      // the ingredient has no out-store row at all, fall back to the previous
      // most-stock-anywhere heuristic so aggregates never drift.
      const locationRows = await locationStockRepo.find({
        where: { ingredientId },
        relations: ['location'],
      });
      let consumedFromName: string | null = null;
      let consumedLocation: {
        id: string | null;
        name: string | null;
        type: string | null;
        previous: number;
        next: number;
      } | null = null;
      if (locationRows.length > 0) {
        const outstoreRows = locationRows.filter(
          (r) => r.location?.type === InventoryLocationType.OUTSTORE,
        );
        const candidates = outstoreRows.length > 0 ? outstoreRows : locationRows;
        candidates.sort(
          (a, b) => Number(b.currentStock) - Number(a.currentStock),
        );
        const target = candidates[0];
        const locationPrevious = Number(target.currentStock);
        target.currentStock = locationPrevious - need;
        await locationStockRepo.save(target);
        consumedFromName = target.location?.name ?? null;
        consumedLocation = {
          id: target.locationId ?? null,
          name: target.location?.name ?? null,
          type: target.location?.type ?? null,
          previous: locationPrevious,
          next: locationPrevious - need,
        };
      }

      ing.currentStock = newStock;
      await ingredientRepo.save(ing);

      await movementRepo.save(
        movementRepo.create({
          ingredientId,
          storeId: ing.storeId,
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
          type: MovementType.CONSUMPTION,
          quantity: -need,
          previousStock,
          newStock,
          fromLocationName: consumedFromName,
          locationId: consumedLocation?.id ?? null,
          locationName: consumedLocation?.name ?? null,
          locationType: consumedLocation?.type ?? null,
          locationPreviousStock: consumedLocation?.previous ?? null,
          locationNewStock: consumedLocation?.next ?? null,
          reason: `Order #${order.orderNumber}`,
          referenceType: 'order',
          referenceId: order.id,
        }),
      );
    }
  }

  /**
   * Inverse of consumeIngredientsForOrder — restores recipe stock when an
   * order that already consumed ingredients is cancelled. Re-credits the
   * location each CONSUMPTION movement debited (matched by name; falls back to
   * the most-stocked row) and records a CORRECTION movement per ingredient so
   * the audit trail shows the reversal. Clears ingredientsConsumedAt; callers
   * must save the order in the same tx.
   */
  private async restoreIngredientsForOrder(
    m: import('typeorm').EntityManager,
    order: OrderEntity,
    actor: ActorContext,
  ): Promise<void> {
    if (!order.ingredientsConsumedAt) return;

    const ingredientRepo = m.getRepository(IngredientEntity);
    const movementRepo = m.getRepository(IngredientMovementEntity);
    const locationStockRepo = m.getRepository(IngredientLocationStockEntity);

    const consumptions = await movementRepo.find({
      where: {
        referenceType: 'order',
        referenceId: order.id,
        type: MovementType.CONSUMPTION,
      },
    });

    for (const mv of consumptions) {
      // Consumption quantities are stored negative; the restore is positive.
      const qty = -Number(mv.quantity);
      if (qty <= 0) continue;

      const ing = await ingredientRepo.findOne({
        where: { id: mv.ingredientId },
      });
      if (!ing) continue;

      const previousStock = Number(ing.currentStock);
      const newStock = previousStock + qty;

      const locationRows = await locationStockRepo.find({
        where: { ingredientId: mv.ingredientId },
        relations: ['location'],
      });
      let restoredLocation: {
        id: string | null;
        name: string | null;
        type: string | null;
        previous: number;
        next: number;
      } | null = null;
      if (locationRows.length > 0) {
        let target = locationRows.find(
          (r) => r.location?.name === mv.fromLocationName,
        );
        if (!target) {
          locationRows.sort(
            (a, b) => Number(b.currentStock) - Number(a.currentStock),
          );
          target = locationRows[0];
        }
        const locationPrevious = Number(target.currentStock);
        target.currentStock = locationPrevious + qty;
        await locationStockRepo.save(target);
        restoredLocation = {
          id: target.locationId ?? null,
          name: target.location?.name ?? null,
          type: target.location?.type ?? null,
          previous: locationPrevious,
          next: locationPrevious + qty,
        };
      }

      ing.currentStock = newStock;
      await ingredientRepo.save(ing);

      await movementRepo.save(
        movementRepo.create({
          ingredientId: mv.ingredientId,
          storeId: ing.storeId,
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
          type: MovementType.CORRECTION,
          quantity: qty,
          previousStock,
          newStock,
          fromLocationName: mv.fromLocationName,
          locationId: restoredLocation?.id ?? null,
          locationName: restoredLocation?.name ?? null,
          locationType: restoredLocation?.type ?? null,
          locationPreviousStock: restoredLocation?.previous ?? null,
          locationNewStock: restoredLocation?.next ?? null,
          reason: `Reversal — order #${order.orderNumber} cancelled`,
          referenceType: 'order',
          referenceId: order.id,
        }),
      );
    }

    order.ingredientsConsumedAt = null;
  }

  /**
   * Settles the outstanding balance of a cash (or channel-less) order the
   * moment staff completes it, so cash collected at hand-over always lands on
   * the financial ledger with a paidAt inside the register window. Never
   * touches orders holding an unpaid online intent (paystack/card/wallet/
   * points) — those settle through their own flows. Callers must save the
   * order in the same tx.
   */
  private async settleUnpaidCashOrder(
    m: import('typeorm').EntityManager,
    order: OrderEntity,
    actor: ActorContext,
  ): Promise<void> {
    if (order.paymentStatus === 'paid') return;
    if (order.paymentChannel && order.paymentChannel !== 'cash') return;

    const amount = Number(order.total) - Number(order.paidAmount);
    if (amount <= 0) return;

    order.paidAmount = Number(order.total);
    order.paymentChannel = 'cash';
    order.paymentStatus = 'paid';
    order.paidAt = new Date();

    await this.ledger.record(
      {
        businessId: order.businessId,
        storeId: order.storeId,
        type: 'credit',
        purpose: 'order_payment',
        amount,
        method: 'cash',
        reference: null,
        description: `Order #${order.orderNumber} payment (collected on completion)`,
        linkedType: 'order',
        linkedId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        staffId: actor.sub_type === 'staff' ? actor.sub : order.staffId,
        staffName: actor.actorName ?? order.staffName ?? null,
      },
      m,
    );
  }

  /**
   * Best-effort customer push notification on order status changes. Never
   * throws — push failures don't interrupt the order flow.
   */
  private async sendOrderStatusPush(
    order: OrderEntity,
    status: OrderStatus,
  ): Promise<void> {
    if (!order.customerId) return;
    const messages: Partial<Record<OrderStatus, { title: string; body: string }>> = {
      [OrderStatus.PREPARING]: {
        title: `Order #${order.orderNumber} confirmed`,
        body: "We're preparing your order now.",
      },
      [OrderStatus.READY]: {
        title: `Order #${order.orderNumber} is ready`,
        body: order.isDelivery
          ? 'A rider has been dispatched.'
          : "Come collect it whenever you're ready.",
      },
      [OrderStatus.SERVED]: {
        title: `Order #${order.orderNumber} delivered`,
        body: 'Enjoy your meal!',
      },
      [OrderStatus.COMPLETED]: {
        title: `Order #${order.orderNumber} completed`,
        body: 'Thanks for ordering — see you next time!',
      },
      [OrderStatus.CANCELLED]: {
        title: `Order #${order.orderNumber} cancelled`,
        body: 'Your order was cancelled. Any pre-payment will be refunded.',
      },
    };
    const msg = messages[status];
    if (!msg) return;
    try {
      await this.pushService.sendToCustomer(order.customerId, {
        title: msg.title,
        body: msg.body,
        url: `/order-tracking/${order.id}`,
        data: { orderId: order.id, status },
      });
    } catch (err) {
      this.logger.warn(
        `Push notification skipped for order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Releases the table attached to an order back to `available` when the order
   * reaches a terminal state. No-op if the table was already moved on (e.g.
   * staff manually set it to `cleaning`).
   */
  private async releaseTableIfAttached(
    tableId: string | null | undefined,
  ): Promise<void> {
    if (!tableId) return;
    await this.tableRepo.update(
      { id: tableId, status: TableStatus.OCCUPIED },
      { status: TableStatus.AVAILABLE },
    );
  }

  private mapPaymentChannelToMethod(
    ch: OrderEntity['paymentChannel'] | null | undefined,
  ): TransactionMethod {
    if (ch === 'paystack' || ch === 'card') return ch === 'card' ? 'card' : 'paystack';
    if (ch === 'cash') return 'cash';
    if (ch === 'wallet') return 'wallet';
    if (ch === 'points') return 'points';
    return 'other';
  }

  /**
   * Allocates the next sequential order number for a store, atomically.
   * Uses Postgres advisory lock keyed by storeId hash to serialize concurrent
   * inserts within the same store while still allowing different stores to
   * write in parallel.
   */
  private async nextOrderNumber(
    manager: DataSource['manager'],
    storeId: string,
  ): Promise<number> {
    // Hash the storeId to a 32-bit int for pg_advisory_xact_lock(int).
    // This lock auto-releases at end of transaction.
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [storeId]);
    const row = await manager
      .createQueryBuilder(OrderEntity, 'o')
      .withDeleted()
      .select('COALESCE(MAX(o.orderNumber), 0)', 'max')
      .where('o.storeId = :storeId', { storeId })
      .getRawOne<{ max: string }>();
    return (parseInt(row?.max ?? '0', 10) || 0) + 1;
  }

  /** Reads the business' workstation auto-accept setting (defaults to false). */
  async isAutoAcceptEnabled(businessId: string): Promise<boolean> {
    const settings = await this.workstationSettingsRepo.findOne({
      where: { businessId },
    });
    return settings?.autoAcceptOrders ?? false;
  }

  /**
   * Resolves the status an order is created at and the chain of transition
   * events to record. New orders default to INITIATED (awaiting acceptance in
   * the counter POS). "accept" (cashier accepting at create) or the
   * auto-accept setting advances to PENDING; "quickBill" advances straight to
   * READY (skips the kitchen for ready-made items).
   */
  private resolveInitialStatusChain(opts: {
    accept?: boolean;
    quickBill?: boolean;
    autoAccept: boolean;
  }): OrderStatus[] {
    const chain: OrderStatus[] = [OrderStatus.INITIATED];
    const accepted = opts.accept || opts.quickBill || opts.autoAccept;
    if (accepted) chain.push(OrderStatus.PENDING);
    if (opts.quickBill) chain.push(OrderStatus.READY);
    return chain;
  }

  /**
   * Auto-creates a delivery record when a delivery order becomes READY. It is
   * created AWAITING_DISPATCH — invisible to riders until the waiter presses
   * "Send for delivery", which moves it to PENDING on the Delivery board.
   * No-op when a delivery already exists for the order (idempotent).
   */
  private async ensureDeliveryForOrder(
    m: import('typeorm').EntityManager,
    order: OrderEntity,
  ): Promise<void> {
    const repo = m.getRepository(DeliveryEntity);
    const existing = await repo.findOne({ where: { orderId: order.id } });
    if (existing) return;

    const addr = (order.deliveryAddress ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;
    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;
    const address =
      [str(addr.line1), str(addr.city), str(addr.state)]
        .filter(Boolean)
        .join(', ') || 'Delivery address';

    await repo.save(
      repo.create({
        orderId: order.id,
        businessId: order.businessId,
        storeId: order.storeId,
        address,
        phone: order.customerPhone ?? null,
        latitude: num(addr.lat) ?? num(addr.latitude),
        longitude: num(addr.lng) ?? num(addr.longitude),
        status: DeliveryStatus.AWAITING_DISPATCH,
      }),
    );
  }

  async create(actor: ActorContext, dto: CreateOrderDto): Promise<OrderResponseDto> {
    if (!actor.storeId) {
      throw new BadRequestException('Order requires a store context');
    }

    const autoAccept = await this.isAutoAcceptEnabled(actor.businessId);
    const statusChain = this.resolveInitialStatusChain({
      accept: dto.accept,
      quickBill: dto.quickBill,
      autoAccept,
    });
    const initialStatus = statusChain[statusChain.length - 1];

    // If the order is being opened against a managed table, look it up and
    // snapshot the label so receipts/reports survive a future rename or
    // delete of the table.
    let tableId: string | null = null;
    let tableNumber: string | null = dto.tableNumber ?? null;
    if (dto.tableId) {
      const table = await this.tableRepo.findOne({ where: { id: dto.tableId } });
      if (!table || table.businessId !== actor.businessId) {
        throw new NotFoundException(`Table ${dto.tableId} not found`);
      }
      tableId = table.id;
      tableNumber = table.name;
    }

    const subtotal = dto.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );

    // Delivery fee comes from the selected region, resolved server-side so the
    // counter can never under/over-charge it.
    let deliveryFee = 0;
    let deliveryRegionId: string | null = null;
    let deliveryRegionName: string | null = null;
    if (dto.isDelivery && dto.deliveryRegionId) {
      const region = await this.deliveryRegionRepo.findOne({
        where: { id: dto.deliveryRegionId },
      });
      if (!region || region.storeId !== actor.storeId) {
        throw new NotFoundException('Delivery region not found for this store');
      }
      deliveryFee = Number(region.fee);
      deliveryRegionId = region.id;
      deliveryRegionName = region.name;
    }

    const taxAmount = Number(dto.taxAmount ?? 0);
    const discountAmount = Number(dto.discountAmount ?? 0);
    const total = subtotal + taxAmount + deliveryFee - discountAmount;

    const saved = await this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.nextOrderNumber(manager, actor.storeId!);
      const estimatedPrepMinutes = await computeEstimatedPrepMinutes(
        manager,
        dto.items,
      );

      const order = manager.create(OrderEntity, {
        orderNumber,
        businessId: actor.businessId,
        storeId: actor.storeId!,
        staffId: actor.sub_type === 'staff' ? actor.sub : null,
        staffName: actor.actorName ?? null,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        tableId,
        tableNumber,
        channel: dto.channel ?? 'pos',
        isDelivery: dto.isDelivery ?? false,
        status: initialStatus,
        estimatedPrepMinutes,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        paidAmount: 0,
        notes: dto.notes ?? null,
        deliveryFee,
        deliveryRegionId,
        deliveryRegionName,
        deliveryAddress: dto.deliveryAddress ?? null,
        items: dto.items.map((i) =>
          manager.create(OrderItemEntity, {
            productId: i.productId ?? null,
            comboId: i.comboId ?? null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            subtotal: Number(i.unitPrice) * i.quantity,
            variation: i.variation ?? null,
            addons: i.addons ?? null,
            notes: i.notes ?? null,
            prepStatus: 'pending',
          }),
        ),
      });

      const persisted = await manager.save(order);

      // Record one event per hop in the resolved status chain (e.g.
      // null→INITIATED→PENDING→READY for a quick bill), so the timeline is
      // accurate regardless of auto-accept / quick-bill.
      let prev: OrderStatus | null = null;
      for (const to of statusChain) {
        await manager.save(
          manager.create(OrderStatusEventEntity, {
            orderId: persisted.id,
            fromStatus: prev,
            toStatus: to,
            actorId: actor.sub,
            actorType: actor.sub_type,
          }),
        );
        prev = to;
      }

      // Orders accepted at create (cashier accept / quick bill / auto-accept)
      // consume their recipe ingredients immediately — same "instant
      // deduction" rule as acceptance via updateStatus.
      if (initialStatus !== OrderStatus.INITIATED) {
        await this.consumeIngredientsForOrder(manager, persisted, actor);
        await manager.save(persisted);
      }

      // Quick Bill can create a delivery order already at READY (skipping the
      // kitchen) — create its delivery record (awaiting waiter dispatch).
      if (initialStatus === OrderStatus.READY && (dto.isDelivery ?? false)) {
        await this.ensureDeliveryForOrder(manager, persisted);
      }

      return persisted;
    });

    // Mark the seated table as occupied after the order persists. Done outside
    // the transaction so a table-write race can't roll back the order.
    if (tableId) {
      await this.tableRepo.update(
        { id: tableId, status: TableStatus.AVAILABLE },
        { status: TableStatus.OCCUPIED },
      );
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.created',
      businessId: actor.businessId,
      storeId: actor.storeId,
      resourceType: 'order',
      resourceId: saved.id,
      metadata: { orderNumber: saved.orderNumber, total: Number(saved.total), itemCount: dto.items.length },
    });

    if (saved.customerId) {
      await this.customersService.recordOrder(saved.customerId, {
        ordersDelta: 1,
        spentDelta: Number(saved.total),
        orderAt: saved.createdAt,
      });
    }

    return this.findOne(actor, saved.id);
  }

  async findAll(
    actor: ActorContext,
    filter: OrderFilterDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    // Staff tenancy is enforced by the store filter below (which includes
    // linked stores from other businesses); everyone else stays business-scoped.
    if (actor.sub_type !== 'staff') {
      qb.andWhere('o.businessId = :businessId', { businessId: actor.businessId });
    }

    if (filter.storeId) qb.andWhere('o.storeId = :storeId', { storeId: filter.storeId });
    // Staff are scoped to their own store, plus any store that has approved a
    // link letting this workstation help run its orders. The businessId filter
    // above would exclude those (a linked store usually belongs to another
    // business), so it is relaxed to "my business OR a store I may help".
    if (actor.sub_type === 'staff' && actor.storeId) {
      const storeIds = await this.storeLinks.accessibleStoreIds(actor.storeId);
      qb.andWhere('o.storeId IN (:...visibleStores)', { visibleStores: storeIds });
    }
    // An online order sits at INITIATED while the customer is still inside the
    // Paystack popup. It must not appear on any workstation surface until the
    // money actually landed — otherwise the counter sees (and can accept) an
    // order that may never be paid. Merchant-dashboard listings are unfiltered
    // so the owner can still see abandoned attempts.
    if (actor.sub_type === 'staff') {
      // IS DISTINCT FROM, not <>: paymentChannel is NULL on counter orders, and
      // `NULL <> 'paystack'` is NULL rather than true — which silently hid every
      // unpaid counter order from the workstation, not just the online ones.
      qb.andWhere(
        "(o.paymentStatus = 'paid' OR o.paymentChannel IS DISTINCT FROM 'paystack' OR o.status <> :initiated)",
        { initiated: OrderStatus.INITIATED },
      );
    }
    if (filter.staffId) qb.andWhere('o.staffId = :staffId', { staffId: filter.staffId });
    if (filter.customerId) qb.andWhere('o.customerId = :customerId', { customerId: filter.customerId });
    if (filter.channel) qb.andWhere('o.channel = :channel', { channel: filter.channel });

    if (filter.status) {
      const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) qb.andWhere('o.status IN (:...statuses)', { statuses });
    }

    if (filter.search) {
      qb.andWhere(
        '(CAST(o.orderNumber AS TEXT) ILIKE :search OR o.customerName ILIKE :search OR o.customerPhone ILIKE :search OR o.tableNumber ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter.dateFrom) qb.andWhere('o.createdAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo) qb.andWhere('o.createdAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, OrderResponseDto.from);
  }

  async findOne(actor: ActorContext, id: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.findEntity(actor, id));
  }

  private async findEntity(actor: ActorContext, id: string): Promise<OrderEntity> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (actor.sub_type === 'staff' && actor.storeId) {
      // A workstation may also work orders for stores that approved a link, so
      // the check is "one of my visible stores" rather than "my business".
      const storeIds = await this.storeLinks.accessibleStoreIds(actor.storeId);
      if (!storeIds.includes(order.storeId)) {
        throw new ForbiddenException('Order belongs to another store');
      }
      return order;
    }
    if (order.businessId !== actor.businessId) {
      throw new ForbiddenException('Order belongs to another business');
    }
    return order;
  }

  async getStats(actor: ActorContext, storeId?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.businessId = :businessId', { businessId: actor.businessId });
    if (storeId) qb.andWhere('o.storeId = :storeId', { storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('o.storeId = :scopedStore', { scopedStore: actor.storeId });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Cancelled orders (and payments that failed) are not business the store
    // did — counting them inflated both today's order count and today's
    // revenue. They stay visible in the orders list, just out of the stats.
    const todayQb = qb
      .clone()
      .andWhere('o.createdAt >= :today', { today: startOfToday })
      .andWhere('o.status <> :cancelled', { cancelled: OrderStatus.CANCELLED })
      .andWhere("o.paymentStatus <> 'failed'");

    const [todayCount, todayRevenueRow, pendingCount, preparingCount, readyCount] = await Promise.all([
      todayQb.clone().getCount(),
      todayQb
        .clone()
        .select('COALESCE(SUM(o.total), 0)', 'total')
        .getRawOne<{ total: string }>(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.PENDING }).getCount(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.PREPARING }).getCount(),
      qb.clone().andWhere('o.status = :s', { s: OrderStatus.READY }).getCount(),
    ]);

    return {
      todayCount,
      todayRevenue: Number(todayRevenueRow?.total ?? 0),
      pendingCount,
      preparingCount,
      readyCount,
    };
  }

  async updateStatus(
    actor: ActorContext,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`,
      );
    }

    // DELIVERING is exclusive to delivery orders, and only once a rider has
    // actually accepted the order (the waiter's "Send for delivery" merely
    // dispatches the delivery to the rider board; rider pickup is what moves
    // the order to DELIVERING).
    if (dto.status === OrderStatus.DELIVERING) {
      if (!order.isDelivery) {
        throw new BadRequestException(
          'Only delivery orders can move to delivering',
        );
      }
      const delivery = await this.dataSource
        .getRepository(DeliveryEntity)
        .findOne({ where: { orderId: order.id } });
      if (!delivery?.riderStaffId) {
        throw new BadRequestException(
          'A rider must accept this order before it can go out for delivery',
        );
      }
    }

    // Cloove first: the marketplace has to accept the move before we make it,
    // so the two systems can never disagree about where an order is. An
    // outage throws and nothing below runs; a refusal Cloove will never take
    // (no kitchen ticket on their side) comes back here to be recorded.
    const clove = await this.pushCloveFirst(order, dto.status);

    const fromStatus = order.status;
    order.status = dto.status;

    // Attribute the sale to the staff member who accepts an unclaimed order
    // (storefront/self-service orders arrive with no staffId). Drives "My
    // Sales" and register close-out coverage.
    if (
      actor.sub_type === 'staff' &&
      !order.staffId &&
      fromStatus === OrderStatus.INITIATED &&
      dto.status !== OrderStatus.CANCELLED
    ) {
      order.staffId = actor.sub;
      order.staffName = actor.actorName ?? null;
    }

    // Anchor the kitchen countdown to when prep actually begins, and record
    // who started preparing (shown on the kitchen card).
    if (dto.status === OrderStatus.PREPARING && !order.preparingStartedAt) {
      order.preparingStartedAt = new Date();
      order.preparingStaffId = actor.sub_type === 'staff' ? actor.sub : null;
      order.preparingStaffName = actor.actorName ?? null;
    }

    await this.dataSource.transaction(async (m) => {
      // Deduct recipe ingredients the moment the order is taken on (first
      // transition past INITIATED), with COMPLETED as the fallback for orders
      // that skipped acceptance. consumeIngredientsForOrder is idempotent via
      // ingredientsConsumedAt, and runs inside the tx so an ingredient
      // failure rolls the status back.
      if (
        dto.status === OrderStatus.PENDING ||
        dto.status === OrderStatus.PREPARING ||
        dto.status === OrderStatus.READY ||
        dto.status === OrderStatus.COMPLETED
      ) {
        await this.consumeIngredientsForOrder(m, order, actor);
      }
      // Cash handed over at completion (waiter serve / rider deliver) must
      // land on the ledger with a paidAt — otherwise registers and the
      // transactions page never see the sale.
      if (dto.status === OrderStatus.COMPLETED) {
        await this.settleUnpaidCashOrder(m, order, actor);
      }
      await m.save(order);
      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus,
          toStatus: dto.status,
          actorId: actor.sub,
          actorType: actor.sub_type,
          // When Cloove would not take the change, the order's own history
          // says so — the alternative is a silent difference between the two
          // systems, which is exactly what this work set out to remove.
          reason: clove.refusal ?? null,
        }),
      );
      // A delivery order that's READY becomes available for the waiter to
      // send out — make sure a delivery record exists (created awaiting
      // dispatch; riders only see it after the waiter sends it).
      if (dto.status === OrderStatus.READY && order.isDelivery) {
        await this.ensureDeliveryForOrder(m, order);
      }
    });

    // Free the seated table when the order reaches a terminal state.
    if (dto.status === OrderStatus.COMPLETED || dto.status === OrderStatus.CANCELLED) {
      await this.releaseTableIfAttached(order.tableId);
    }

    // Best-effort customer push on every status change.
    await this.sendOrderStatusPush(order, dto.status);

    // Marketplace orders carry their status back to the marketplace. Fire and
    // forget: Chowdeck being slow or down must not stall the POS.
    await this.pushExternalStatus(order, fromStatus, dto.status, null);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: `order.${dto.status}`,
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, from: fromStatus, to: dto.status },
    });

    return this.findOne(actor, order.id);
  }

  /**
   * Books money a sales channel collected on the merchant's behalf.
   *
   * A Cloove order arrives already paid — the customer paid Cloove, not the
   * till — and the ingest used to stamp `paidAmount` straight onto the row.
   * That left the sale out of the transactions ledger entirely, and with it
   * out of the register and account balancing, because both read real
   * payments. The channel money is booked here instead, as the merchant asked,
   * under `card`: it is not cash in the drawer, and the cashier must not be
   * asked to count it.
   */
  async recordChannelPayment(
    orderId: string,
    opts: { method: TransactionMethod; channelName: string },
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || Number(order.paidAmount) <= 0) return;
    await this.ledger.record({
      businessId: order.businessId,
      storeId: order.storeId,
      type: 'credit',
      purpose: 'order_payment',
      amount: Number(order.paidAmount),
      method: opts.method,
      reference: order.externalReference,
      description: `Order #${order.orderNumber} paid on ${opts.channelName}`,
      linkedType: 'order',
      linkedId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      // No cashier took this money, so no one's sales figures may claim it.
      staffId: null,
      staffName: opts.channelName,
    });
  }

  /**
   * "Send to kitchen" — the counter's next step after accepting an order.
   *
   * It is not a lifecycle transition here: an accepted order is already
   * PENDING and already sitting in the kitchen board's New column, waiting for
   * a cook to press Start Preparing. What it does do is mark the ticket as
   * handed over (so the counter stops offering the button) and, on Cloove,
   * move the kitchen ticket to `queued` — the stage the merchant's flow calls
   * for at this point, and the one that tells the customer their order is in.
   *
   * Cloove is called first; if it refuses, nothing is marked here.
   */
  async sendToKitchen(actor: ActorContext, id: string): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        order.status === OrderStatus.INITIATED
          ? 'Accept this order before sending it to the kitchen'
          : `A ${order.status} order cannot be sent to the kitchen`,
      );
    }
    // Idempotent, and deliberately so: pressing the button twice must not
    // drag a ticket Cloove has already moved on to back to `queued`.
    if (order.sentToKitchenAt) return this.findOne(actor, order.id);

    const clove = await this.pushCloveFirst(order, CLOVE_SEND_TO_KITCHEN);

    // A targeted update, not a save of the loaded graph: findEntity brings the
    // items along and this changes one column on the order itself.
    order.sentToKitchenAt = new Date();
    await this.orderRepo.update({ id: order.id }, { sentToKitchenAt: order.sentToKitchenAt });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.sent_to_kitchen',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        ...(clove.refusal ? { cloveNotSynced: clove.refusal } : {}),
      },
    });

    return this.findOne(actor, order.id);
  }

  /**
   * Relays a status change to the marketplace the order came from.
   *
   * Only marketplace orders (those carrying an `externalReference`) do
   * anything. Deliberately swallows every failure: an outage at Chowdeck must
   * never surface as a failed status change in the POS, and the attempt is
   * logged inside the integration for replay.
   *
   * Cloove is **not** relayed here — see `pushCloveFirst`, which runs before
   * the local change instead of after it.
   */
  private async pushExternalStatus(
    order: OrderEntity,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    reason: string | null,
  ): Promise<void> {
    if (!order.externalReference) return;

    if (order.channel === 'chowdeck') {
      try {
        await this.chowdeck.pushStatus({
          storeId: order.storeId,
          externalReference: order.externalReference,
          fromStatus,
          toStatus,
          reason,
        });
      } catch (err) {
        this.logger.warn(
          `Chowdeck status push failed for order ${order.orderNumber}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Cloove before us, on the merchant's instruction: "all update request first
   * goes to clove, if returned successfully and request is implemented, it
   * then makes the necessary update to omega, all in that one singular
   * request… to make sure omega always shares same order conditions with
   * what's on clove."
   *
   * So this runs BEFORE the local write and deliberately does not catch:
   * if Cloove refuses the transition, or cannot be reached, the exception
   * travels back to the workstation and the order stays exactly where it was
   * on both sides. Anything that is not a Cloove order is a no-op.
   */
  private async pushCloveFirst(
    order: OrderEntity,
    toStatus: string,
    reason: string | null = null,
  ): Promise<{ pushed: boolean; refusal?: string }> {
    if (order.channel !== 'clove' || !order.externalReference) return { pushed: false };
    const result = await this.clove.pushStatus({
      storeId: order.storeId,
      externalReference: order.externalReference,
      toStatus,
      reason,
    });
    if (result.refusal) {
      this.logger.warn(
        `Order ${order.orderNumber}: Cloove did not take ${toStatus} — ${result.refusal}`,
      );
    }
    return result;
  }

  async cancel(
    actor: ActorContext,
    id: string,
    dto: CancelOrderDto,
    opts?: { skipExternalPush?: boolean },
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a ${order.status} order`);
    }

    // Reject/Cancel on a Cloove order cancels it on Cloove first; only then is
    // it cancelled here. `skipExternalPush` is for the opposite direction —
    // the order was cancelled on Cloove and we are catching up, so pushing it
    // back would be a round trip that can only fail.
    const clove = opts?.skipExternalPush
      ? { pushed: false as boolean, refusal: undefined as string | undefined }
      : await this.pushCloveFirst(order, OrderStatus.CANCELLED, dto.reason ?? null);

    const fromStatus = order.status;
    const wasPaid = order.paymentStatus === 'paid';
    order.status = OrderStatus.CANCELLED;

    await this.dataSource.transaction(async (m) => {
      // Refund the customer's monetary artefacts inside the same tx as the
      // status change so a refund failure rolls back the cancellation.
      await this.refundOrderArtefacts(m, order, actor);

      // Put consumed recipe ingredients back on the shelf — deduction now
      // happens at acceptance, so a cancelled order must restore stock.
      await this.restoreIngredientsForOrder(m, order, actor);

      // Mark the order as fully refunded after compensation if it was paid.
      if (wasPaid) {
        order.paymentStatus = 'refunded';
        order.refundedAmount = Number(order.paidAmount);
      } else if (order.paymentStatus === 'pending') {
        order.paymentStatus = 'failed';
      }

      await m.save(order);
      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus,
          toStatus: OrderStatus.CANCELLED,
          actorId: actor.sub,
          actorType: actor.sub_type,
          // Cloove will not cancel an order it collected by automated bank
          // transfer; the order's history has to say that it is still live
          // there, so somebody refunds it.
          reason: [dto.reason ?? null, clove.refusal].filter(Boolean).join(' · ') || null,
        }),
      );
    });

    // Free the seated table now that the order is cancelled.
    await this.releaseTableIfAttached(order.tableId);

    await this.sendOrderStatusPush(order, OrderStatus.CANCELLED);

    // Tell the marketplace we can't fulfil it — their reject endpoint requires
    // a reason, so pass the one staff gave.
    await this.pushExternalStatus(
      order,
      fromStatus,
      OrderStatus.CANCELLED,
      dto.reason ?? null,
    );

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.cancelled',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, reason: dto.reason ?? null },
    });

    if (order.customerId) {
      await this.customersService.recordOrder(order.customerId, {
        ordersDelta: -1,
        spentDelta: -Number(order.total),
      });
    }

    return this.findOne(actor, order.id);
  }

  /**
   * Inverts every monetary side-effect of an order on cancellation:
   *  • returns wallet pre-debit (storefront wallet orders held funds at place())
   *  • re-credits redeemed loyalty points
   *  • releases the coupon usage counter + redemption row
   *  • for paid Paystack orders, issues a Paystack refund and emits a debit
   *    on the financial ledger
   *
   * Idempotent — safe to re-run because each step checks for non-zero state
   * before writing.
   */
  private async refundOrderArtefacts(
    mgr: import('typeorm').EntityManager,
    order: OrderEntity,
    actor: ActorContext,
  ): Promise<void> {
    const customerRepo = mgr.getRepository(CustomerEntity);
    const walletTxRepo = mgr.getRepository(WalletTransactionEntity);
    const pointsTxRepo = mgr.getRepository(PointsTransactionEntity);

    // Restore wallet held by storefront wallet/points pre-debit OR refund a
    // wallet-paid order. For Paystack-paid orders, the refund happens via
    // Paystack below and we don't touch the wallet balance.
    if (order.customerId && order.paymentChannel === 'wallet' && Number(order.total) > 0) {
      const customer = await customerRepo.findOne({ where: { id: order.customerId } });
      if (customer) {
        const refundAmount = Number(order.paidAmount) > 0
          ? Number(order.paidAmount)
          : Number(order.total);
        if (refundAmount > 0) {
          customer.walletBalance = Number(customer.walletBalance) + refundAmount;
          await customerRepo.save(customer);
          const tx = await walletTxRepo.save(
            walletTxRepo.create({
              customerId: customer.id,
              type: WalletTransactionType.CREDIT,
              amount: refundAmount,
              balance: Number(customer.walletBalance),
              description: `Refund — order #${order.orderNumber} cancelled`,
              reference: `order:${order.id}`,
            }),
          );
          await this.ledger.record(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              type: 'debit',
              purpose: 'order_refund',
              amount: refundAmount,
              method: 'wallet',
              reference: `order:${order.id}`,
              description: `Wallet refund — order #${order.orderNumber}`,
              linkedType: 'wallet_tx',
              linkedId: tx.id,
              customerId: customer.id,
              customerName: customer.firstName
                ? `${customer.firstName} ${customer.lastName}`.trim()
                : null,
              staffId: actor.sub,
              staffName: actor.actorName ?? null,
            },
            mgr,
          );
        }
      }
    }

    // Restore loyalty points redeemed at checkout.
    if (order.customerId && order.pointsRedeemed > 0) {
      const customer = await customerRepo.findOne({ where: { id: order.customerId } });
      if (customer) {
        customer.points = customer.points + order.pointsRedeemed;
        await customerRepo.save(customer);
        await pointsTxRepo.save(
          pointsTxRepo.create({
            customerId: customer.id,
            type: PointsTransactionType.ADJUSTED,
            points: order.pointsRedeemed,
            balance: customer.points,
            description: `Refund — order #${order.orderNumber} cancelled`,
            orderId: order.id,
          }),
        );
      }
    }

    // Release the coupon: decrement usageCount and remove the redemption row.
    if (order.couponId) {
      await this.coupons.unredeem(order.couponId, order.couponRedemptionId, mgr);
    }

    // Issue Paystack refund for paid card orders. Wrap the network call in a
    // try/catch so a Paystack outage doesn't break the cancellation — the
    // refund will still appear on the order's audit trail and admin can
    // re-issue manually.
    if (
      order.paymentChannel === 'paystack' &&
      order.paymentStatus === 'paid' &&
      order.paymentReference &&
      Number(order.paidAmount) > 0
    ) {
      try {
        const refundAmount = Number(order.paidAmount);
        // Refund from this merchant's own Paystack account.
        const cred = await this.integrations.getActiveCredential(
          order.businessId,
          'paystack',
        );
        await this.paystack.refund(
          order.paymentReference,
          Math.round(refundAmount * 100),
          cred?.secretKey,
        );
        await this.ledger.record(
          {
            businessId: order.businessId,
            storeId: order.storeId,
            type: 'debit',
            purpose: 'order_refund',
            amount: refundAmount,
            method: this.mapPaymentChannelToMethod(order.paymentChannel),
            reference: order.paymentReference,
            description: `Paystack refund — order #${order.orderNumber}`,
            linkedType: 'order',
            linkedId: order.id,
            customerId: order.customerId,
            customerName: order.customerName,
            staffId: actor.sub,
            staffName: actor.actorName ?? null,
          },
          mgr,
        );
        // Reverse the original merchant-wallet credit. Allow overdraft so a
        // merchant who already paid out can still issue refunds — wallet may
        // go negative until offset by future order revenue.
        await this.merchantWallet.debit(
          {
            businessId: order.businessId,
            storeId: order.storeId,
            reason: 'order_refund',
            amount: refundAmount,
            description: `Refund — order #${order.orderNumber}`,
            linkedType: 'order',
            linkedId: order.id,
            allowOverdraft: true,
          },
          mgr,
        );
      } catch (err) {
        // Don't block the cancel — admin will re-issue manually.
        // Re-throw a softer error so the caller still sees something useful.
        throw new BadRequestException(
          `Paystack refund failed: ${(err as Error).message}. Cancel rolled back.`,
        );
      }
    }

    // A marketplace order was booked on the ledger when it arrived (the
    // channel had already taken the money), so rejecting it has to take that
    // entry back off — otherwise the day's takings keep a sale that was never
    // made. The money itself is refunded by the channel, not by us.
    if (
      order.externalReference &&
      (order.channel === 'clove' || order.channel === 'chowdeck') &&
      order.paymentStatus === 'paid' &&
      Number(order.paidAmount) > 0
    ) {
      const channelName = order.channel === 'clove' ? 'Cloove' : 'Chowdeck';
      await this.ledger.record(
        {
          businessId: order.businessId,
          storeId: order.storeId,
          type: 'debit',
          purpose: 'order_refund',
          amount: Number(order.paidAmount),
          method: this.mapPaymentChannelToMethod(order.paymentChannel),
          reference: order.externalReference,
          description: `Order #${order.orderNumber} cancelled — refunded by ${channelName}`,
          linkedType: 'order',
          linkedId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
        },
        mgr,
      );
    }
  }

  async recordPayment(
    actor: ActorContext,
    id: string,
    dto: RecordPaymentDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment on a cancelled order');
    }

    const amount = Number(dto.amount ?? Number(order.total) - Number(order.paidAmount));
    if (amount <= 0) throw new BadRequestException('Payment amount must be positive');

    await this.dataSource.transaction(async (m) => {
      // A cashier taking payment for an unclaimed order (storefront/self
      // orders arrive with no staffId) claims the sale — mirrors the
      // acceptance stamp in updateStatus.
      if (actor.sub_type === 'staff' && !order.staffId) {
        order.staffId = actor.sub;
        order.staffName = actor.actorName ?? null;
      }
      order.paidAmount = Number(order.paidAmount) + amount;
      if (dto.paymentMethodId) order.paymentMethodId = dto.paymentMethodId;
      if (dto.paymentChannel) order.paymentChannel = dto.paymentChannel;
      if (dto.paymentReference) order.paymentReference = dto.paymentReference;
      const wasNotCompleted = order.status !== OrderStatus.COMPLETED;
      if (Number(order.paidAmount) >= Number(order.total)) {
        order.paidAt = new Date();
        order.paymentStatus = 'paid';
        if (order.status === OrderStatus.SERVED) {
          order.status = OrderStatus.COMPLETED;
        }
      }
      await m.save(order);

      // If this payment was the trigger that closed out the order, deduct
      // recipe ingredients from inventory now (same tx as the order save).
      if (wasNotCompleted && order.status === OrderStatus.COMPLETED) {
        await this.consumeIngredientsForOrder(m, order, actor);
      }

      await this.ledger.record(
        {
          businessId: actor.businessId,
          storeId: order.storeId,
          type: 'credit',
          purpose: 'order_payment',
          amount,
          method: this.mapPaymentChannelToMethod(order.paymentChannel),
          reference: order.paymentReference ?? null,
          description: `Order #${order.orderNumber} payment`,
          linkedType: 'order',
          linkedId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          staffId: actor.sub_type === 'staff' ? actor.sub : order.staffId,
          staffName: actor.actorName ?? order.staffName ?? null,
        },
        m,
      );

      // Credit the merchant payout wallet for genuinely new money. Cash sits
      // in the till; wallet/points are intra-account movement and don't bring
      // payable cash to the merchant. Paystack/card payments do.
      if (
        order.paymentChannel === 'paystack' ||
        order.paymentChannel === 'card'
      ) {
        try {
          await this.merchantWallet.credit(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              reason: 'order_payment',
              amount,
              description: `Order #${order.orderNumber} payment`,
              linkedType: 'order',
              linkedId: order.id,
            },
            m,
          );
        } catch (err) {
          this.logger.warn(
            `Merchant wallet credit failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }
    });

    // If the payment closed out the order (SERVED → COMPLETED above), free
    // the seated table back to `available`.
    if (order.status === OrderStatus.COMPLETED) {
      await this.releaseTableIfAttached(order.tableId);
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.payment_recorded',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        amount,
        paidAmount: Number(order.paidAmount),
        paymentMethodId: dto.paymentMethodId ?? null,
      },
    });

    return this.findOne(actor, order.id);
  }

  async refund(
    actor: ActorContext,
    id: string,
    dto: { amount: number; reason?: string },
  ): Promise<OrderResponseDto> {
    const order = await this.findEntity(actor, id);
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    const refundable = Number(order.paidAmount) - Number(order.refundedAmount ?? 0);
    if (amount > refundable) {
      throw new BadRequestException(
        `Refund amount exceeds refundable balance (${refundable})`,
      );
    }

    await this.dataSource.transaction(async (m) => {
      order.refundedAmount = Number(order.refundedAmount ?? 0) + amount;
      const netPaid = Number(order.paidAmount) - Number(order.refundedAmount);
      const fullyRefunded = netPaid <= 0;
      if (fullyRefunded) {
        order.paymentStatus = 'refunded';
      }
      await m.save(order);

      await m.save(
        m.create(OrderStatusEventEntity, {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorId: actor.sub,
          actorType: actor.sub_type,
          reason: dto.reason ?? `Refund: ₦${amount}${fullyRefunded ? ' (full)' : ' (partial)'}`,
        }),
      );

      await this.ledger.record(
        {
          businessId: actor.businessId,
          storeId: order.storeId,
          type: 'debit',
          purpose: 'order_refund',
          amount,
          method: this.mapPaymentChannelToMethod(order.paymentChannel),
          reference: order.paymentReference ?? null,
          description: `Order #${order.orderNumber} refund${dto.reason ? ` — ${dto.reason}` : ''}`,
          linkedType: 'order',
          linkedId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
        },
        m,
      );

      // Reverse the original merchant-wallet credit for paystack/card orders.
      if (
        order.paymentChannel === 'paystack' ||
        order.paymentChannel === 'card'
      ) {
        try {
          await this.merchantWallet.debit(
            {
              businessId: order.businessId,
              storeId: order.storeId,
              reason: 'order_refund',
              amount,
              description: `Refund — order #${order.orderNumber}${dto.reason ? ` — ${dto.reason}` : ''}`,
              linkedType: 'order',
              linkedId: order.id,
              allowOverdraft: true,
            },
            m,
          );
        } catch (err) {
          this.logger.warn(
            `Merchant wallet refund debit failed for order ${order.id}: ${(err as Error).message}`,
          );
        }
      }
    });

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.refunded',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        amount,
        reason: dto.reason ?? null,
      },
    });

    return this.findOne(actor, order.id);
  }

  async getEvents(actor: ActorContext, id: string) {
    await this.findEntity(actor, id);
    return this.eventRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async updateItemPrepStatus(
    actor: ActorContext,
    orderId: string,
    itemId: string,
    dto: UpdatePrepStatusDto,
  ): Promise<OrderItemResponseDto> {
    const order = await this.findEntity(actor, orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order ${orderId}`);

    item.prepStatus = dto.prepStatus;
    await this.itemRepo.save(item);

    // Auto-transition order status based on aggregate item prep states.
    const reloaded = await this.findEntity(actor, orderId);
    const allReady = reloaded.items.every((i) => i.prepStatus === 'ready');
    const anyPreparing = reloaded.items.some((i) => i.prepStatus === 'preparing');

    // Route auto-transitions through updateStatus rather than saving the
    // status column directly. Writing it here skipped every side effect the
    // status change owns — most visibly ensureDeliveryForOrder, so ticking off
    // items one by one in the KDS moved the order to READY but never created
    // the delivery, and it never reached the Delivery board unless the
    // order-level "Ready" button was used. Table release, the customer push,
    // ingredient consumption and the preparing-staff stamp were skipped too.
    if (allReady && reloaded.status === OrderStatus.PREPARING) {
      await this.updateStatus(actor, orderId, { status: OrderStatus.READY });
    } else if (anyPreparing && reloaded.status === OrderStatus.PENDING) {
      await this.updateStatus(actor, orderId, { status: OrderStatus.PREPARING });
    }

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Unknown',
      action: 'order.item_prep_updated',
      businessId: actor.businessId,
      storeId: order.storeId,
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, itemId, itemName: item.name, prepStatus: dto.prepStatus },
    });

    return OrderItemResponseDto.from(item);
  }
}
