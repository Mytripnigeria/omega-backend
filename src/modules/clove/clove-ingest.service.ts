import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloveClient, CloveOrder } from './clove.client';
import { CloveIntegrationEntity } from './entities/clove-integration.entity';
import { CloveService } from './clove.service';
import { OrdersService } from '../orders/orders.service';
import { OrderEntity } from '../orders/entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';

/**
 * Cloove orders → our POS.
 *
 * Cloove is **pulled**, not pushed: their API exposes `GET /v1/orders` and we
 * hold the key, so polling needs nothing configured on their side (unlike
 * Chowdeck's webhook, which the merchant has to paste a URL into). Ingestion is
 * idempotent on `externalReference`, so re-pulling the same page is safe.
 */
@Injectable()
export class CloveIngestService {
  private readonly logger = new Logger(CloveIngestService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly clove: CloveService,
    private readonly client: CloveClient,
    private readonly orders: OrdersService,
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
    const results: Array<{
      cloveOrderId: string;
      outcome: 'ingested' | 'duplicate' | 'skipped' | 'failed';
      orderNumber?: number;
      reason?: string;
    }> = [];

    for (const order of page.data ?? []) {
      if (!this.isIngestible(order)) {
        results.push({
          cloveOrderId: order.id,
          outcome: 'skipped',
          reason: `status ${order.status}`,
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
      skipped: results.filter((r) => r.outcome === 'skipped').length,
      failed: results.filter((r) => r.outcome === 'failed').length,
      results,
    };
  }

  /**
   * Cloove webhook: the posted body only names an order; the order itself is
   * read back from Cloove with our own key before anything is written, so a
   * forged post achieves nothing. `token`, when present, pins the delivery to
   * one channel; otherwise every enabled channel is tried until one recognises
   * the order.
   */
  async handleWebhook(
    body: {
      data?: { id?: string; orderId?: string; order?: { id?: string } };
      orderId?: string;
      id?: string;
    },
    token?: string,
  ) {
    const cloveOrderId =
      body?.data?.order?.id ??
      body?.data?.orderId ??
      body?.data?.id ??
      body?.orderId ??
      body?.id;
    if (!cloveOrderId) {
      return { handled: false, reason: 'no order id in payload' };
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
        return { handled: true, skipped: true, reason: `status ${order.status}` };
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
  async simulateIncomingOrder(integration: CloveIntegrationEntity) {
    const mapped = await this.clove.mappedItems(integration.id, 2);
    if (mapped.length === 0) {
      throw new BadRequestException(
        "Publish this channel's menu to Cloove first — a test order is built " +
          'from products that are actually mapped.',
      );
    }
    const order: CloveOrder = {
      id: `test-${Date.now().toString(36)}`,
      shortCode: null,
      status: 'pending',
      paymentStatus: 'paid',
      currency: 'NGN',
      channel: 'clove-test',
      createdAt: new Date().toISOString(),
      customer: { name: 'Cloove Test', phoneNumber: null },
      items: mapped.map((m, i) => ({
        id: `test-item-${i}`,
        productId: m.cloveProductId,
        variantId: null,
        productName: m.name ?? 'Cloove item',
        variantName: null,
        quantity: i === 0 ? 2 : 1,
        unitPrice: 0,
        totalPrice: 0,
      })),
    };
    return this.ingestOrder(integration, order);
  }

  private async ingestOrder(
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
        customerName: cloveOrder.customer?.name?.trim() || 'Cloove customer',
        customerPhone: cloveOrder.customer?.phoneNumber ?? undefined,
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
