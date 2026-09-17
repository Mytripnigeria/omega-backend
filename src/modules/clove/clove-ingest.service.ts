import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CloveClient, CloveOrder } from './clove.client';

import { CloveIntegrationEntity } from './entities/clove-integration.entity';
import { CloveService } from './clove.service';
import { OrdersService } from '../orders/orders.service';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CustomersService } from '../customers/customers.service';
import { CustomerSource } from '../customers/entities/customer.entity';
/** What Cloove posts — typed loosely on purpose; see the webhook controller. */
export interface CloveEventBody {
  id?: string;
  type?: string;
  event?: string;
  data?: {
    entityType?: string;
    entityId?: string;
    id?: string;
    orderId?: string;
    order?: { id?: string };
    [key: string]: unknown;
  };
  orderId?: string;
  [key: string]: unknown;
}

/**
 * Cloove orders → our POS.
 *
 * Two doors, both idempotent on `externalReference`:
 *   - Cloove's webhook (`/webhook/cloveai/:channel`), for orders as they happen;
 *   - a pull of `GET /v1/orders` — on the merchant's button, and on a timer, so
 *     an order still arrives when the webhook was never registered or a
 *     delivery was lost. A merchant tested a chatbot order with neither in
 *     place and, naturally, nothing reached the workstation.
 */
@Injectable()
export class CloveIngestService implements OnModuleInit {
  private readonly logger = new Logger(CloveIngestService.name);

  /** Orders older than this are never pulled onto a counter. */
  static readonly PULL_WINDOW_MS = 24 * 60 * 60 * 1000;
  /** Overlap with the previous pull, so an order landing mid-pull is not lost. */
  static readonly PULL_OVERLAP_MS = 5 * 60 * 1000;

  private pullInFlight = false;
  /** Channels whose last scheduled pull failed — so a bad key is reported once, not every two minutes. */
  private readonly failingChannels = new Set<string>();
  /** Work in progress per Cloove order; see withOrderLock. */
  private readonly inFlightByReference = new Map<string, Promise<unknown>>();

  onModuleInit(): void {
    // Every two minutes by default; CLOVE_PULL_INTERVAL_MS=0 turns it off.
    // setInterval keeps this dependency-free, unref() keeps it from holding
    // the process open — the same shape as the shift auto-clock-out sweep.
    const raw = process.env.CLOVE_PULL_INTERVAL_MS;
    const every = raw === undefined ? 120_000 : Number(raw);
    if (!Number.isFinite(every) || every <= 0) return;
    const timer = setInterval(() => {
      this.pullAllEnabled().catch((err) =>
        this.logger.warn(`Cloove scheduled pull failed: ${(err as Error).message}`),
      );
    }, every);
    if (typeof timer.unref === 'function') timer.unref();
  }

  /** The timer's pass: every enabled channel, one after another, never overlapping. */
  async pullAllEnabled(): Promise<void> {
    if (this.pullInFlight) return;
    this.pullInFlight = true;
    try {
      const channels = await this.clove.listEnabledWithSecrets();
      for (const integration of channels) {
        const name = integration.label ?? integration.id;
        try {
          const res = await this.pullOrders(integration, { limit: 50 });
          if (res.ingested > 0 || res.cancelled > 0 || res.failed > 0) {
            this.logger.log(
              `Cloove pull (${name}): ${res.ingested} new, ${res.cancelled} cancelled, ${res.failed} failed`,
            );
          }
          if (this.failingChannels.delete(integration.id)) {
            this.logger.log(`Cloove pull for ${name} is working again`);
          }
        } catch (err) {
          // A channel saved with a wrong key (one merchant pasted a webhook
          // secret as the API key) would otherwise log the same 401 forever.
          if (!this.failingChannels.has(integration.id)) {
            this.failingChannels.add(integration.id);
            this.logger.warn(
              `Cloove pull for ${name} failed and will be retried quietly: ${(err as Error).message}`,
            );
          }
        }
      }
    } finally {
      this.pullInFlight = false;
    }
  }

  /**
   * Where a pull starts reading from: the last pull (less an overlap), and
   * never more than a day back. Cloove's list is newest-first and unbounded,
   * and every order it holds is "completed" once paid — so without a window
   * the first automatic pull would put July's orders on today's counter.
   */
  static pullWindowStart(integration: CloveIntegrationEntity, now = Date.now()): number {
    const floor = now - CloveIngestService.PULL_WINDOW_MS;
    const last = integration.lastOrderSyncAt
      ? new Date(integration.lastOrderSyncAt).getTime() - CloveIngestService.PULL_OVERLAP_MS
      : 0;
    return Math.max(floor, last);
  }

  private placedAt(order: CloveOrder): number | null {
    const raw = order.createdAt ?? order.occurredAt;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly clove: CloveService,
    private readonly client: CloveClient,
    private readonly orders: OrdersService,
    private readonly customers: CustomersService,
  ) {}

  /** Only orders worth putting on a counter: placed and not already dead. */
  private isIngestible(order: CloveOrder): boolean {
    const status = (order.status ?? '').toLowerCase();
    return !['cancelled', 'canceled', 'refunded', 'draft', 'voided'].includes(status);
  }

  private reference(order: CloveOrder): string {
    return `CLOVE-${order.id}`;
  }

  /**
   * Pulls a page of Cloove orders and ingests any we have not seen.
   * Returns a per-order outcome so the merchant can see exactly what happened.
   */
  async pullOrders(
    integration: CloveIntegrationEntity,
    opts?: { limit?: number },
  ) {
    const creds = this.clove.credentialsOf(integration);
    const page = await this.client.listOrders(creds, 1, opts?.limit ?? 25);
    const since = CloveIngestService.pullWindowStart(integration);
    const results: Array<{
      cloveOrderId: string;
      outcome: 'ingested' | 'duplicate' | 'cancelled' | 'skipped' | 'failed';
      orderNumber?: number;
      reason?: string;
    }> = [];

    for (const order of page.data ?? []) {
      const placed = this.placedAt(order);
      if (placed !== null && placed < since) {
        results.push({
          cloveOrderId: order.id,
          outcome: 'skipped',
          reason: 'older than the pull window',
        });
        continue;
      }
      if (!this.isIngestible(order)) {
        const closed = await this.reconcileClosed(integration, order);
        results.push({
          cloveOrderId: order.id,
          outcome: closed.cancelled ? 'cancelled' : 'skipped',
          orderNumber: closed.orderNumber,
          reason: closed.cancelled ? undefined : (closed.reason ?? `status ${order.status}`),
        });
        continue;
      }
      try {
        const res = await this.ingestOrder(integration, order);
        results.push({
          cloveOrderId: order.id,
          outcome: res.duplicate ? 'duplicate' : 'ingested',
          orderNumber: res.orderNumber,
        });
      } catch (err) {
        results.push({
          cloveOrderId: order.id,
          outcome: 'failed',
          reason: (err as Error).message,
        });
      }
    }

    await this.clove.markOrderSync(integration.id);
    return {
      pulled: (page.data ?? []).length,
      ingested: results.filter((r) => r.outcome === 'ingested').length,
      duplicates: results.filter((r) => r.outcome === 'duplicate').length,
      /** Local orders cancelled because the customer cancelled on Cloove. */
      cancelled: results.filter((r) => r.outcome === 'cancelled').length,
      skipped: results.filter((r) => r.outcome === 'skipped').length,
      /** Of the skipped, how many were simply older than the pull window. */
      skippedOld: results.filter((r) => r.reason === 'older than the pull window').length,
      failed: results.filter((r) => r.outcome === 'failed').length,
      results,
    };
  }

  /**
   * The order a Cloove event is about, or null when the event is not about an
   * order at all.
   *
   * Cloove's documented envelope is `{ id, type: "order.created", data: {
   * entityType: "sale", entityId, storeId, metadata } }` — the top-level `id`
   * is the EVENT id, so reading it as the order id (the earlier guess) fetched
   * nothing and every real delivery would have been dropped. Older shapes
   * (`data.orderId`, `orderId`) are still accepted.
   */
  static orderIdFromEvent(body: CloveEventBody | null | undefined): string | null {
    const type =
      typeof body?.type === 'string' ? body.type : typeof body?.event === 'string' ? body.event : null;
    const data = body?.data ?? {};
    if (data.entityId && (data.entityType === 'sale' || (type ?? '').startsWith('order.'))) {
      return String(data.entityId);
    }
    if (type && !type.startsWith('order.') && type !== 'payment.received') return null;
    const id = data.order?.id ?? data.orderId ?? data.id ?? body?.orderId ?? body?.id;
    return id ? String(id) : null;
  }

  /**
   * Cloove webhook: the posted body only names an order; the order itself is
   * read back from Cloove with our own key before anything is written, so a
   * forged post achieves nothing. `token`, when present, pins the delivery to
   * one channel; otherwise every enabled channel is tried until one recognises
   * the order.
   */
  async handleWebhook(body: CloveEventBody, token?: string) {
    const cloveOrderId = CloveIngestService.orderIdFromEvent(body);
    if (!cloveOrderId) {
      return { handled: false, reason: 'not an order event' };
    }

    let channels = await this.clove.listEnabledWithSecrets();
    if (token) channels = channels.filter((c) => c.id === token);
    if (channels.length === 0) {
      return { handled: false, reason: 'no enabled Cloove channel' };
    }

    for (const integration of channels) {
      const order = await this.client.getOrder(
        this.clove.credentialsOf(integration),
        String(cloveOrderId),
      );
      if (!order) continue;
      if (!this.isIngestible(order)) {
        const closed = await this.reconcileClosed(integration, order);
        return closed.cancelled
          ? { handled: true, cancelled: true, orderId: closed.orderId, orderNumber: closed.orderNumber }
          : { handled: true, skipped: true, reason: closed.reason ?? `status ${order.status}` };
      }
      return this.ingestOrder(integration, order);
    }
    return { handled: false, reason: 'no channel recognises this order' };
  }

  /**
   * Injects a synthetic Cloove order through the real ingest path, so the
   * workstation flow can be rehearsed before going live. Lines come from
   * products actually mapped to this channel, so the id map and stock
   * deduction are exercised rather than stubbed.
   */
  /**
   * Inject a realistic Cloove order through the same path a pulled one takes.
   *
   * As with Chowdeck, this used to arrive as a customer called "Cloove Test"
   * with no phone and every line priced at zero, which made it useless for
   * rehearsing the counter flow. Prices now come from the real mapped
   * products and the customer is someone the cashier could actually call.
   */
  async simulateIncomingOrder(integration: CloveIntegrationEntity) {
    const mapped = await this.clove.mappedItems(integration.id, 2);
    if (mapped.length === 0) {
      throw new BadRequestException(
        "Publish this channel's menu to Cloove first — a test order is built " +
          'from products that are actually mapped.',
      );
    }

    const products = await this.productRepo.find({
      where: { id: In(mapped.map((m) => m.productId)) },
    });
    const priceOf = new Map(
      products.map((pr) => [pr.id, Number(pr.sellingPrice)]),
    );

    const items = mapped.map((m, i) => {
      const quantity = i === 0 ? 2 : 1;
      // Cloove deals in naira decimals, not kobo.
      const unitPrice = priceOf.get(m.productId) ?? 0;
      return {
        id: `test-item-${i}`,
        productId: m.cloveProductId,
        variantId: null,
        productName: m.name ?? 'Cloove item',
        variantName: null,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    });

    const order: CloveOrder = {
      id: `test-${Date.now().toString(36)}`,
      shortCode: null,
      status: 'pending',
      paymentStatus: 'paid',
      currency: 'NGN',
      channel: 'clove-test',
      createdAt: new Date().toISOString(),
      totalAmount: items.reduce((sum, it) => sum + it.totalPrice, 0),
      customer: {
        name: 'Chinedu Eze',
        phoneNumber: '+2348030000303',
        whatsappNumber: '+2348030000303',
        email: 'chinedu.eze@clove-test.example',
      },
      items,
    };
    return this.ingestOrder(integration, order);
  }

  /**
   * A Cloove order that is cancelled or refunded, seen again: if we already
   * put it on the counter and nobody has started on it, take it off. Once it
   * is in the kitchen the cashier decides — the customer's cancellation is
   * logged, not enforced.
   */
  private async reconcileClosed(
    integration: CloveIntegrationEntity,
    cloveOrder: CloveOrder,
  ): Promise<{ cancelled: boolean; orderId?: string; orderNumber?: number; reason?: string }> {
    const local = await this.orderRepo.findOne({
      where: { externalReference: this.reference(cloveOrder) },
    });
    if (!local) return { cancelled: false, reason: `status ${cloveOrder.status}` };
    if (local.status === OrderStatus.CANCELLED) {
      return { cancelled: false, orderId: local.id, orderNumber: local.orderNumber, reason: 'already cancelled here' };
    }
    if (local.status !== OrderStatus.INITIATED && local.status !== OrderStatus.PENDING) {
      this.logger.warn(
        `Cloove order ${cloveOrder.shortCode ?? cloveOrder.id} was cancelled on Cloove but ` +
          `#${local.orderNumber} is already ${local.status} — left for the cashier`,
      );
      return { cancelled: false, orderId: local.id, orderNumber: local.orderNumber, reason: `already ${local.status} here` };
    }
    await this.orders.cancel(
      {
        sub: integration.id,
        sub_type: 'admin',
        businessId: integration.businessId,
        storeId: integration.storeId,
        actorName: 'Cloove',
      },
      local.id,
      { reason: `Cancelled on Cloove (${cloveOrder.status})` },
    );
    this.logger.log(
      `Cloove order ${cloveOrder.shortCode ?? cloveOrder.id} cancelled on Cloove — #${local.orderNumber} cancelled here`,
    );
    return { cancelled: true, orderId: local.id, orderNumber: local.orderNumber };
  }

  /**
   * Serialises work on one Cloove order. The webhook and the timer can meet
   * on the same order within a second, and `externalReference` — the unique
   * key that makes the second one a duplicate — is stamped only after the
   * row exists, so without this the loser would leave an orphan order behind.
   * (In-process: enough for one API instance; more would need the lock in
   * the database.)
   */
  private async withOrderLock<T>(reference: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.inFlightByReference.get(reference) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    this.inFlightByReference.set(reference, run);
    try {
      return await run;
    } finally {
      if (this.inFlightByReference.get(reference) === run) {
        this.inFlightByReference.delete(reference);
      }
    }
  }

  private ingestOrder(integration: CloveIntegrationEntity, cloveOrder: CloveOrder) {
    return this.withOrderLock(this.reference(cloveOrder), () =>
      this.ingestOrderUnlocked(integration, cloveOrder),
    );
  }

  private async ingestOrderUnlocked(
    integration: CloveIntegrationEntity,
    cloveOrder: CloveOrder,
  ) {
    const reference = this.reference(cloveOrder);

    // Idempotent: the pull re-reads the same page, and a duplicate must never
    // create a second order (nor deduct stock twice).
    const existing = await this.orderRepo.findOne({
      where: { externalReference: reference },
    });
    if (existing) {
      return {
        handled: true,
        duplicate: true,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
      };
    }

    const lines = await this.resolveLines(integration, cloveOrder);
    if (lines.length === 0) {
      throw new BadRequestException(
        `Cloove order ${cloveOrder.id} has no resolvable items`,
      );
    }

    const cloveCustomer = cloveOrder.customer;
    const customerName = cloveCustomer?.name?.trim() || 'Cloove customer';
    const customerPhone =
      cloveCustomer?.phoneNumber ?? cloveCustomer?.whatsappNumber ?? undefined;

    // Register the person behind the order so they reach the customers list
    // and their repeat orders accumulate against one record.
    const customerRecord = await this.customers.findOrCreateFromChannel(
      integration.businessId,
      {
        name: customerName,
        email: cloveCustomer?.email ?? null,
        phone: customerPhone ?? null,
        source: CustomerSource.CLOVE,
      },
    );

    const created = await this.orders.create(
      {
        // The integration row is the actor; its id is a real uuid, which the
        // activity log's actorId column requires.
        sub: integration.id,
        sub_type: 'admin',
        businessId: integration.businessId,
        storeId: integration.storeId,
        actorName: 'Cloove',
      },
      {
        channel: 'clove',
        ...(customerRecord ? { customerId: customerRecord.id } : {}),
        customerName,
        customerPhone,
        notes: this.buildNote(cloveOrder),
        accept: integration.autoAccept || undefined,
        items: lines,
      },
    );

    // The client's spec: a marketplace order is registered on the workstation
    // as 'initiated' with payment 'paid' — Cloove has already taken the money,
    // and the cashier still takes the order on (unless auto-accept is set).
    await this.orderRepo.update(
      { id: created.id },
      {
        externalReference: reference,
        paymentStatus: 'paid',
        paidAmount: Number(created.total),
        paidAt: new Date(),
      },
    );

    this.logger.log(
      `Cloove order ${cloveOrder.id} ingested as #${created.orderNumber} ` +
        `(store ${integration.storeId})`,
    );
    return {
      handled: true,
      duplicate: false,
      orderId: created.id,
      orderNumber: created.orderNumber,
      items: lines.length,
    };
  }

  /**
   * Cloove line → our order line. Resolution order: the channel's id map, then
   * an exact name match inside this store. An unmatched line still appears (so
   * the kitchen is never short-made) but carries no productId, hence no stock
   * deduction — the same rule Chowdeck ingestion follows.
   */
  private async resolveLines(
    integration: CloveIntegrationEntity,
    cloveOrder: CloveOrder,
  ) {
    const storeId = integration.storeId;
    const lines: Array<{
      productId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of cloveOrder.items ?? []) {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;

      let productId: string | undefined;
      if (item.productId) {
        productId =
          (await this.clove.productIdForCloveId(integration.id, item.productId)) ??
          undefined;
      }
      let name = item.productName ?? 'Cloove item';

      if (!productId && item.productName) {
        const byName = await this.productRepo
          .createQueryBuilder('p')
          .where('p.storeId = :storeId', { storeId })
          .andWhere('LOWER(p.name) = LOWER(:name)', { name: item.productName.trim() })
          .getOne();
        if (byName) {
          productId = byName.id;
          name = byName.name;
        }
      }

      lines.push({
        ...(productId ? { productId } : {}),
        name,
        quantity,
        // Cloove quotes naira decimals, so no kobo conversion here.
        unitPrice: Number(item.unitPrice ?? 0),
      });
    }
    return lines;
  }

  private buildNote(order: CloveOrder): string {
    const bits = [`Cloove order ${order.shortCode ?? order.id}`];
    if (order.channel) bits.push(`channel ${order.channel}`);
    if (order.notes) bits.push(order.notes);
    return bits.join(' · ');
  }
}
