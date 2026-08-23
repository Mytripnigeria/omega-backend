import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChowdeckClient,
  ChowdeckApiError,
  type ChowdeckOrder,
} from './chowdeck.client';
import { ChowdeckIntegrationEntity } from './entities/chowdeck-integration.entity';
import { ChowdeckService, fromKobo } from './chowdeck.service';
import { ChowdeckWebhookBody } from './dto/chowdeck-integration.dto';
import { OrdersService } from '../orders/orders.service';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';

/** Events Chowdeck sends. Anything else is acknowledged and ignored. */
const ORDER_CREATED = 'ORDER_CREATED';
const ORDER_COMPLETE = 'ORDER_COMPLETE';

@Injectable()
export class ChowdeckIngestService {
  private readonly logger = new Logger(ChowdeckIngestService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly chowdeck: ChowdeckService,
    private readonly client: ChowdeckClient,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Entry point for `POST /webhook/chowdeck[/:token]`.
   *
   * Chowdeck publishes no signature scheme and the payload carries no merchant
   * reference, so the webhook is both **authenticated and routed** by calling
   * Chowdeck back: whichever configured merchant can fetch this order
   * reference owns it. A forged payload for an order that doesn't exist gets
   * nowhere, and the record we act on is Chowdeck's own copy rather than
   * anything the caller sent us.
   */
  async handle(body: ChowdeckWebhookBody, token?: string) {
    const category = String(body?.category ?? body?.event ?? '').toUpperCase();
    const reference = String(body?.payload?.reference ?? '').trim();
    if (!reference) {
      throw new BadRequestException('Webhook payload has no order reference');
    }

    const resolved = await this.resolveOrigin(reference, token);
    if (!resolved) {
      // Nothing owns it — either forged, or for a store that isn't connected.
      throw new UnauthorizedException(
        'No enabled Chowdeck integration recognises this order',
      );
    }
    const { integration, order: chowdeckOrder } = resolved;

    await this.chowdeck
      .findWithSecret({ id: integration.id })
      .then(() =>
        this.orderRepo.manager
          .getRepository(ChowdeckIntegrationEntity)
          .update({ id: integration.id }, { lastWebhookAt: new Date() }),
      )
      .catch(() => undefined);

    switch (category) {
      case ORDER_CREATED:
        return this.ingestOrder(integration, chowdeckOrder);
      case ORDER_COMPLETE:
        return this.completeOrder(integration, chowdeckOrder);
      default:
        // ORDER_ASSIGNED / AWAITING_PICKUP / PICKED_UP / ARRIVED_AT_CUSTOMER —
        // rider-side progress we surface but don't act on.
        this.logger.log(
          `Chowdeck ${category || 'event'} for ${reference} acknowledged (no local action)`,
        );
        return { handled: false, category, reference };
    }
  }

  /**
   * Finds the integration that owns an order reference, and the authoritative
   * order alongside it.
   *
   * Fast paths first: an explicit webhook token, then an order we've already
   * ingested. Otherwise every enabled integration is probed — cheap in
   * practice because each store has at most one Chowdeck merchant.
   */
  private async resolveOrigin(
    reference: string,
    token?: string,
  ): Promise<{
    integration: ChowdeckIntegrationEntity;
    order: ChowdeckOrder;
  } | null> {
    const candidates = await this.chowdeck.listEnabledWithSecrets();
    if (candidates.length === 0) return null;

    let ordered = candidates;
    if (token) {
      const matched = candidates.filter((c) => c.webhookToken === token);
      // A token that matches nothing is a bad credential, not a routing hint.
      if (matched.length === 0) {
        throw new UnauthorizedException('Unrecognised Chowdeck webhook token');
      }
      ordered = matched;
    } else {
      const known = await this.orderRepo.findOne({
        where: { externalReference: reference },
        select: { id: true, storeId: true },
      });
      if (known) {
        ordered = [
          ...candidates.filter((c) => c.storeId === known.storeId),
          ...candidates.filter((c) => c.storeId !== known.storeId),
        ];
      }
    }

    for (const integration of ordered) {
      try {
        const order = await this.client.getOrder(
          this.chowdeck.credentialsOf(integration),
          reference,
        );
        if (order) return { integration, order };
      } catch (err) {
        if (err instanceof ChowdeckApiError && err.isNotFound) continue;
        // A transient outage shouldn't look like a forged webhook: surface it
        // so Chowdeck retries rather than silently dropping a real order.
        this.logger.warn(
          `Chowdeck lookup failed for ${reference} on merchant ` +
            `${integration.merchantReference}: ${(err as Error).message}`,
        );
      }
    }
    return null;
  }

  /** ORDER_CREATED → a local order sitting in the POS, already paid. */
  /**
   * Injects a synthetic Chowdeck order through the real ingest path.
   *
   * Chowdeck's sandbox has no way for a merchant to create an order against
   * their own vendor (`POST /order` 404s), and the webhook authenticates by
   * calling Chowdeck back — so a merchant genuinely could not rehearse
   * "an order arrives and my workstation handles it" before going live.
   * This is that rehearsal: it is an authenticated merchant action scoped to
   * their own store, so it needs no webhook trust, and it exercises exactly the
   * same ingest → POS → kitchen path a real order takes.
   *
   * Lines are drawn from products already mapped to this channel, so stock
   * deduction and the menu-id map are exercised too, not stubbed.
   */
  async simulateIncomingOrder(
    integration: ChowdeckIntegrationEntity,
    opts?: { reference?: string },
  ) {
    const mapped = await this.chowdeck.mappedMenuItems(integration.id, 2);
    if (mapped.length === 0) {
      throw new BadRequestException(
        'Publish this channel\'s menu to Chowdeck first — a test order is ' +
          'built from products that are actually mapped.',
      );
    }
    const reference =
      opts?.reference ?? `TEST-${Date.now().toString(36).toUpperCase()}`;

    const items = mapped.map((m, i) => ({
      id: Number(m.chowdeckMenuId),
      quantity: i === 0 ? 2 : 1,
      price_per_quantity: 0,
      description: m.name,
    }));

    const order: ChowdeckOrder = {
      id: Date.now() % 2_000_000_000,
      reference,
      status: 'order_placed',
      total_price: 0,
      currency: 'NGN',
      source: 'chowdeck-test',
      created_at: new Date().toISOString(),
      customer: {
        first_name: 'Chowdeck',
        last_name: 'Test',
        email: null,
        phone: null,
      },
      items,
      vendor_information: { name: integration.label ?? 'Chowdeck' },
    };

    return this.ingestOrder(integration, order);
  }

  private async ingestOrder(
    integration: ChowdeckIntegrationEntity,
    chowdeckOrder: ChowdeckOrder,
  ) {
    const reference = chowdeckOrder.reference;

    // Idempotent: Chowdeck retries, and a duplicate must never create a second
    // order (nor deduct stock twice).
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

    const lines = await this.resolveLines(integration, chowdeckOrder);
    if (lines.length === 0) {
      throw new BadRequestException(
        `Chowdeck order ${reference} has no resolvable items`,
      );
    }

    const customer = chowdeckOrder.customer;
    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() ||
      'Chowdeck customer';
    const address = chowdeckOrder.customer_address;

    const created = await this.orders.create(
      {
        // The integration row is the actor. Its id is a real uuid, which the
        // activity log's actorId column requires.
        sub: integration.id,
        sub_type: 'admin',
        businessId: integration.businessId,
        storeId: integration.storeId,
        actorName: 'Chowdeck',
      },
      {
        channel: 'chowdeck',
        isDelivery: true,
        customerName,
        customerPhone: customer?.phone ?? undefined,
        // Chowdeck's rider handles the leg, so the fee is theirs, not revenue
        // we book — the note keeps it visible for reconciliation.
        notes: this.buildNote(chowdeckOrder),
        deliveryAddress: address
          ? {
              line1: address.street ?? address.pretty_name ?? '',
              city: address.city ?? undefined,
              state: address.state ?? undefined,
              latitude: address.coordinate?.y,
              longitude: address.coordinate?.x,
            }
          : undefined,
        // Chowdeck orders are prepaid; staff still take them on in the POS
        // unless the merchant opted into auto-accept.
        accept: integration.autoAccept || undefined,
        items: lines,
      },
    );

    // Stamp the link and the settled payment. Done straight on the row so the
    // shared create() path stays untouched by channel-specific concerns.
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
      `Chowdeck order ${reference} ingested as #${created.orderNumber} ` +
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

  /** ORDER_COMPLETE → the customer has the food; close ours out too. */
  private async completeOrder(
    integration: ChowdeckIntegrationEntity,
    chowdeckOrder: ChowdeckOrder,
  ) {
    const order = await this.orderRepo.findOne({
      where: { externalReference: chowdeckOrder.reference },
    });
    if (!order) {
      throw new BadRequestException(
        `No local order for Chowdeck reference ${chowdeckOrder.reference}`,
      );
    }
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      return { handled: true, alreadyClosed: true, orderId: order.id };
    }

    await this.orders.updateStatus(
      {
        // The integration row is the actor. Its id is a real uuid, which the
        // activity log's actorId column requires.
        sub: integration.id,
        sub_type: 'admin',
        businessId: integration.businessId,
        storeId: integration.storeId,
        actorName: 'Chowdeck',
      },
      order.id,
      { status: OrderStatus.COMPLETED },
    );
    this.logger.log(
      `Chowdeck order ${chowdeckOrder.reference} completed (#${order.orderNumber})`,
    );
    return { handled: true, orderId: order.id, status: OrderStatus.COMPLETED };
  }

  /**
   * Chowdeck lines → our order lines.
   *
   * Each line is identified only by Chowdeck's numeric menu id, so it's
   * resolved through the menu map built at sync time; failing that we fall
   * back to an exact name match within the store. A line that resolves to
   * neither is still kept — with no productId — so the kitchen sees the full
   * order rather than silently short-making it. Such a line simply doesn't
   * deduct stock.
   */
  private async resolveLines(
    integration: ChowdeckIntegrationEntity,
    chowdeckOrder: ChowdeckOrder,
  ) {
    const storeId = integration.storeId;
    const items = chowdeckOrder.items ?? [];
    const lines: Array<{
      productId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;

      // Scoped to the channel: the same product carries a different numeric
      // menu id on each Chowdeck vendor listing this store sells through.
      let productId = await this.chowdeck.productIdForMenuId(
        integration.id,
        item.id,
      );
      let name = item.description ?? `Chowdeck item ${item.id}`;

      if (!productId && item.description) {
        const byName = await this.productRepo
          .createQueryBuilder('p')
          .where('p.storeId = :storeId', { storeId })
          .andWhere('LOWER(p.name) = LOWER(:name)', {
            name: item.description.trim(),
          })
          .getOne();
        if (byName) {
          productId = byName.id;
          name = byName.name;
        }
      }
      if (!productId) {
        this.logger.warn(
          `Chowdeck menu id ${item.id} ("${item.description ?? ''}") is not ` +
            `mapped to a product in store ${storeId} — the line will not ` +
            `deduct inventory. Run a menu sync.`,
        );
      }

      lines.push({
        ...(productId ? { productId } : {}),
        name,
        quantity,
        unitPrice: fromKobo(Number(item.price_per_quantity) || 0),
      });
    }
    return lines;
  }

  private buildNote(order: ChowdeckOrder): string {
    const parts = [`Chowdeck order ${order.reference}`];
    if (order.delivery_price) {
      parts.push(
        `delivery ₦${fromKobo(order.delivery_price).toLocaleString()} (paid to Chowdeck)`,
      );
    }
    if (order.summary) parts.push(order.summary.trim());
    return parts.join(' · ');
  }
}
