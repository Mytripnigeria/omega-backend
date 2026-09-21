import { BadRequestException } from '@nestjs/common';
import { CloveIngestService } from './clove-ingest.service';
import { CustomerSource } from '../customers/entities/customer.entity';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Round-11 feedback, "Through the test order i noticed" — the Cloove half.
 * Cloove's order API carries no address or rider (it is a social-commerce
 * catalogue, not a delivery network), so the delivery-information item applies
 * to Chowdeck only; everything else applies to both.
 */
describe('CloveIngestService.simulateIncomingOrder', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    autoAccept: false,
  } as never;

  const build = (opts: { mapped?: unknown[] } = {}) => {
    const orderRepo = mockRepo<Record<string, any>>([]);
    const productRepo = mockRepo<Record<string, any>>([
      productFixture({ id: 'prod-jollof', name: 'Jollof Rice', price: 1500, sellingPrice: 4500 }),
      productFixture({ id: 'prod-suya', name: 'Suya Skewers', price: 900, sellingPrice: 2500 }),
    ]);
    const clove = {
      mappedItems: jest.fn(async () =>
        opts.mapped ?? [
          { productId: 'prod-jollof', cloveProductId: 'clove-1', name: 'Jollof Rice' },
          { productId: 'prod-suya', cloveProductId: 'clove-2', name: 'Suya Skewers' },
        ],
      ),
      productIdForCloveId: jest.fn(async (_i: string, id: string) =>
        id === 'clove-1' ? 'prod-jollof' : 'prod-suya',
      ),
    };
    const orders = {
      create: jest.fn(async (_a: unknown, dto: Record<string, any>) => ({
        id: 'order-1',
        orderNumber: 'ORD-0001',
        total: (dto.items as Array<Record<string, number>>).reduce(
          (s, l) => s + l.unitPrice * l.quantity,
          0,
        ),
      })),
      updateStatus: jest.fn(),
      recordChannelPayment: jest.fn(async () => undefined),
    };
    const customers = {
      findOrCreateFromChannel: jest.fn(async () => ({ id: 'cust-1' })),
    };
    const service = new CloveIngestService(
      orderRepo as never,
      productRepo as never,
      clove as never,
      { } as never,
      orders as never,
      customers as never,
    );
    return { service, orderRepo, orders, customers };
  };

  const dtoOf = (orders: { create: jest.Mock }) =>
    orders.create.mock.calls[0][1] as Record<string, any>;

  it('carries a real customer name and phone, not "Clove Test"', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    const dto = dtoOf(orders);
    expect(dto.customerName).toBe('Chinedu Eze');
    expect(dto.customerName).not.toMatch(/clove test/i);
    expect(dto.customerPhone).toBe('+2348030000303');
  });

  it('registers the customer against the business', async () => {
    const { service, customers } = build();

    await service.simulateIncomingOrder(integration);

    expect(customers.findOrCreateFromChannel).toHaveBeenCalledWith('biz-1', {
      name: 'Chinedu Eze',
      email: 'chinedu.eze@clove-test.example',
      phone: '+2348030000303',
      source: CustomerSource.CLOVE,
    });
  });

  it('prices lines from the selling price in naira, never ₦0 and never the cost', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    const lines = dtoOf(orders).items as Array<Record<string, any>>;
    expect(lines.every((l) => l.unitPrice > 0)).toBe(true);
    const jollof = lines.find((l) => l.name === 'Jollof Rice');
    expect(jollof?.unitPrice).toBe(4500);
    expect(jollof?.unitPrice).not.toBe(1500);
  });

  it('marks the order paid for the amount actually ordered', async () => {
    const { service, orderRepo } = build();

    await service.simulateIncomingOrder(integration);

    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch.paymentStatus).toBe('paid');
    expect(patch.paidAmount).toBe(4500 * 2 + 2500);
  });

  it('links the created customer to the order', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    expect(dtoOf(orders).customerId).toBe('cust-1');
  });

  it('refuses to fabricate an order with nothing mapped', async () => {
    const { service, orders } = build({ mapped: [] });

    await expect(service.simulateIncomingOrder(integration)).rejects.toThrow(
      BadRequestException,
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('tags the order to the clove channel', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    expect(dtoOf(orders).channel).toBe('clove');
  });
});

/**
 * Client, the day after the mirror went live: "i tested making an order via
 * clove chatbot but i didint get it in our workstation". Two doors, both shut:
 * the webhook parser read Cloove's EVENT id as the order id, and nothing
 * pulled on a timer.
 */
describe('CloveIngestService — orders coming in', () => {
  const integration = {
    id: 'int-1',
    label: 'Scoops bot',
    businessId: 'biz-1',
    storeId: 'store-1',
    apiKey: 'sk',
    baseUrl: 'https://api.clooveai.com',
    isEnabled: true,
    autoAccept: false,
    lastOrderSyncAt: null as Date | null,
  };
  const cloveOrder = (over: Record<string, unknown> = {}) => ({
    id: 'ord-1',
    shortCode: '366580',
    status: 'completed',
    paymentStatus: 'paid',
    totalAmount: 400,
    createdAt: new Date().toISOString(),
    customer: { name: 'Philip Okoye', phoneNumber: '+2348030000000' },
    items: [{ id: 'li-1', productId: 'clove-water', variantId: null, productName: 'Water', variantName: null, quantity: 1, unitPrice: 400, totalPrice: 400 }],
    ...over,
  });

  const build = (opts: { orders?: Array<Record<string, unknown>>; integration?: Record<string, unknown>; local?: Array<Record<string, unknown>> } = {}) => {
    const orderRepo = mockRepo<Record<string, any>>((opts.local ?? []) as Record<string, any>[]);
    const productRepo = mockRepo<Record<string, any>>([
      productFixture({ id: 'prod-water', name: 'Water', sellingPrice: 400 }),
    ]);
    const clove = {
      listEnabledWithSecrets: jest.fn(async () => [{ ...integration, ...opts.integration }]),
      credentialsOf: jest.fn(() => ({ apiKey: 'sk', baseUrl: 'https://api.clooveai.com' })),
      productIdForCloveId: jest.fn(async () => 'prod-water'),
      markOrderSync: jest.fn(
        async (_integrationId: string, _oldestUnpaid?: Date | null) => undefined,
      ),
    };
    const client = {
      getOrder: jest.fn(async (_c: unknown, id: string) =>
        (opts.orders ?? [cloveOrder()]).find((o) => o.id === id) ?? null,
      ),
      listOrders: jest.fn(async () => ({ data: opts.orders ?? [cloveOrder()] })),
    };
    let seq = 100;
    const orders = {
      // The real OrdersService persists the row; the ingest then stamps the
      // external reference onto it, which is what makes a re-delivery a duplicate.
      create: jest.fn(async (_actor: unknown, dto: Record<string, unknown>) => {
        const lines = (dto.items as Array<{ unitPrice: number; quantity: number }>) ?? [];
        const subtotal = lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);
        const row = {
          id: `order-${seq}`,
          orderNumber: seq,
          // Mirrors the real create(): lines less any discount Cloove applied,
          // with delivery priced separately (and stamped by the ingest).
          total: subtotal - Number(dto.discountAmount ?? 0),
        };
        seq += 1;
        orderRepo.rows.push(row);
        return row;
      }),
      recordChannelPayment: jest.fn(async () => undefined),
      cancel: jest.fn(async (_a: unknown, id: string) => {
        const row = orderRepo.rows.find((r) => r.id === id);
        if (row) row.status = 'cancelled';
        return row;
      }),
    };
    const customers = { findOrCreateFromChannel: jest.fn(async () => ({ id: 'cust-1' })) };
    const service = new CloveIngestService(
      orderRepo as never,
      productRepo as never,
      clove as never,
      client as never,
      orders as never,
      customers as never,
    );
    return { service, client, orders, clove, orderRepo };
  };

  describe('webhook', () => {
    it("reads the order id from Cloove's documented event envelope, not the event id", async () => {
      const { service, client, orders } = build();

      const res = await service.handleWebhook(
        {
          id: 'evt-123',
          type: 'order.created',
          apiVersion: 'v1',
          data: { entityType: 'sale', entityId: 'ord-1', storeId: 'st', metadata: { shortCode: '366580', totalAmount: 400 } },
        },
        'int-1',
      );

      expect(client.getOrder).toHaveBeenCalledWith(expect.anything(), 'ord-1');
      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ handled: true, duplicate: false });
    });

    it('treats a payment.received event for a sale as that order', () => {
      expect(
        CloveIngestService.orderIdFromEvent({ id: 'evt', type: 'payment.received', data: { entityType: 'sale', entityId: 'ord-9' } }),
      ).toBe('ord-9');
    });

    it('ignores events that are not about an order instead of fetching the event id', async () => {
      const { service, client } = build();

      const res = await service.handleWebhook({ id: 'evt-1', type: 'contact.created', data: { entityType: 'contact', entityId: 'c-1' } });

      expect(client.getOrder).not.toHaveBeenCalled();
      expect(res).toEqual({ handled: false, reason: 'not an order event' });
    });

    it('still accepts the older shapes', () => {
      expect(CloveIngestService.orderIdFromEvent({ orderId: 'ord-2' })).toBe('ord-2');
      expect(CloveIngestService.orderIdFromEvent({ data: { orderId: 'ord-3' } })).toBe('ord-3');
      expect(CloveIngestService.orderIdFromEvent({ data: { order: { id: 'ord-4' } } })).toBe('ord-4');
      expect(CloveIngestService.orderIdFromEvent({})).toBeNull();
    });

    it('is idempotent — the same order twice creates one POS order', async () => {
      const { service, orders } = build();
      const event = { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } };

      const first = await service.handleWebhook(event, 'int-1');
      const second = await service.handleWebhook(event, 'int-1');

      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(second).toMatchObject({ handled: true, duplicate: true, orderNumber: (first as { orderNumber: number }).orderNumber });
    });
  });

  describe('pull window', () => {
    const hours = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString();

    it("never puts last month's orders on today's counter", async () => {
      const { service, orders } = build({
        orders: [
          cloveOrder({ id: 'fresh', createdAt: hours(2) }),
          cloveOrder({ id: 'july', createdAt: hours(24 * 50) }),
        ],
      });

      const res = await service.pullOrders(integration as never);

      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(res.ingested).toBe(1);
      expect(res.skippedOld).toBe(1);
      expect(res.results.find((r) => r.cloveOrderId === 'july')).toMatchObject({ outcome: 'skipped', reason: 'older than the pull window' });
    });

    it('starts from the last pull, with a few minutes of overlap', () => {
      const now = Date.parse('2026-09-17T12:00:00Z');
      const lastPull = new Date('2026-09-17T11:00:00Z');
      const start = CloveIngestService.pullWindowStart({ ...integration, lastOrderSyncAt: lastPull } as never, now);
      expect(start).toBe(lastPull.getTime() - CloveIngestService.PULL_OVERLAP_MS);
    });

    it('goes back at most a day when the last pull was long ago', () => {
      const now = Date.parse('2026-09-17T12:00:00Z');
      const start = CloveIngestService.pullWindowStart({ ...integration, lastOrderSyncAt: new Date('2026-08-31T12:00:00Z') } as never, now);
      expect(start).toBe(now - CloveIngestService.PULL_WINDOW_MS);
    });

    it('the timer pass pulls every enabled channel and records the pull', async () => {
      const { service, orders, clove } = build({ orders: [cloveOrder({ id: 'fresh', createdAt: hours(1) })] });

      await service.pullAllEnabled();

      expect(clove.listEnabledWithSecrets).toHaveBeenCalledTimes(1);
      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(clove.markOrderSync).toHaveBeenCalledWith('int-1', null);
    });
  });

  describe('cancellations', () => {
    const local = (status: string) => ({ id: 'order-1', orderNumber: 55, externalReference: 'CLOVE-ord-1', status });
    const cancelledEvent = { type: 'order.cancelled', data: { entityType: 'sale', entityId: 'ord-1' } };

    it('takes an un-started order off the counter when the customer cancels on Cloove', async () => {
      const { service, orders } = build({ orders: [cloveOrder({ status: 'cancelled' })], local: [local('initiated')] });

      const res = await service.handleWebhook(cancelledEvent, 'int-1');

      expect(orders.cancel).toHaveBeenCalledWith(
        expect.objectContaining({ actorName: 'Cloove', businessId: 'biz-1' }),
        'order-1',
        { reason: 'Cancelled on Cloove (cancelled)' },
        // Cloove cancelled it; cancelling it back on Cloove could only fail.
        { skipExternalPush: true },
      );
      expect(res).toMatchObject({ handled: true, cancelled: true, orderNumber: 55 });
    });

    it('leaves an order that is already in the kitchen to the cashier', async () => {
      const { service, orders } = build({ orders: [cloveOrder({ status: 'cancelled' })], local: [local('preparing')] });

      const res = await service.handleWebhook(cancelledEvent, 'int-1');

      expect(orders.cancel).not.toHaveBeenCalled();
      expect(res).toMatchObject({ handled: true, skipped: true, reason: 'already preparing here' });
    });

    it('does nothing for a cancelled order we never had', async () => {
      const { service, orders } = build({ orders: [cloveOrder({ status: 'cancelled' })] });

      const res = await service.handleWebhook(cancelledEvent, 'int-1');

      expect(orders.cancel).not.toHaveBeenCalled();
      expect(orders.create).not.toHaveBeenCalled();
      expect(res).toMatchObject({ handled: true, skipped: true, reason: 'status cancelled' });
    });

    it('the pull propagates cancellations too', async () => {
      const { service, orders } = build({ orders: [cloveOrder({ status: 'cancelled' })], local: [local('pending')] });

      const res = await service.pullOrders(integration as never);

      expect(orders.cancel).toHaveBeenCalledTimes(1);
      expect(res.cancelled).toBe(1);
      expect(res.results[0]).toMatchObject({ outcome: 'cancelled', orderNumber: 55 });
    });
  });

  /**
   * The merchant's report: "the order gets to the workstation when payment has
   * not been made". Cloove announces an order as soon as its assistant records
   * it — paying comes after — so both doors now check `paymentStatus` first.
   */
  describe('payment gate', () => {
    const unpaid = (over: Record<string, unknown> = {}) =>
      cloveOrder({ status: 'pending', paymentStatus: 'pending', ...over });

    it('does not register an unpaid order from the webhook', async () => {
      const { service, orders } = build({ orders: [unpaid()] });

      const res = await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      expect(orders.create).not.toHaveBeenCalled();
      expect(res).toMatchObject({ handled: true, skipped: true, unpaid: true });
      expect((res as { reason: string }).reason).toMatch(/awaiting payment/i);
    });

    it('registers the same order once Cloove reports it paid', async () => {
      const { service, orders, client } = build({ orders: [unpaid()] });
      const event = { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } };

      await service.handleWebhook(event, 'int-1');
      // The customer pays; Cloove sends payment.received for the same order.
      client.getOrder.mockResolvedValue(cloveOrder() as never);
      const res = await service.handleWebhook(
        { type: 'payment.received', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ handled: true, duplicate: false });
    });

    it('treats a part-paid order as unpaid', async () => {
      const { service, orders } = build({ orders: [unpaid({ paymentStatus: 'partial', amountPaid: 200 })] });

      await service.pullOrders(integration as never);

      expect(orders.create).not.toHaveBeenCalled();
    });

    it('counts the unpaid ones separately in a pull', async () => {
      const { service, orders } = build({
        orders: [cloveOrder({ id: 'paid-1' }), unpaid({ id: 'unpaid-1' })],
      });

      const res = await service.pullOrders(integration as never);

      expect(orders.create).toHaveBeenCalledTimes(1);
      expect(res.ingested).toBe(1);
      expect(res.unpaid).toBe(1);
      expect(res.results.find((r) => r.cloveOrderId === 'unpaid-1')).toMatchObject({
        outcome: 'unpaid',
      });
    });

    it('keeps the pull window open back to the oldest unpaid order', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { service, clove } = build({
        orders: [
          cloveOrder({ id: 'paid-1', createdAt: oneHourAgo }),
          unpaid({ id: 'unpaid-1', createdAt: threeHoursAgo }),
        ],
      });

      await service.pullOrders(integration as never);

      // Without this the window would advance to now, and the payment landing
      // an hour later would find the order already out of sight.
      const [, watermark] = clove.markOrderSync.mock.calls[0];
      expect(new Date(watermark as Date).toISOString()).toBe(threeHoursAgo);
    });

    it('clears the watermark once nothing is outstanding', async () => {
      const { service, clove } = build({ orders: [cloveOrder({ id: 'paid-1' })] });

      await service.pullOrders(integration as never);

      expect(clove.markOrderSync.mock.calls[0][1]).toBeNull();
    });

    it('the window reaches back to an unpaid order, but never past the day floor', () => {
      const now = Date.parse('2026-09-20T12:00:00Z');
      const lastPull = new Date('2026-09-20T11:55:00Z');
      const withUnpaid = {
        ...integration,
        lastOrderSyncAt: lastPull,
        oldestUnsettledOrderAt: new Date('2026-09-20T08:00:00Z'),
      };
      expect(CloveIngestService.pullWindowStart(withUnpaid as never, now)).toBe(
        Date.parse('2026-09-20T08:00:00Z'),
      );
      // An order left unpaid for days stops holding the window open.
      const stale = { ...withUnpaid, oldestUnsettledOrderAt: new Date('2026-09-01T08:00:00Z') };
      expect(CloveIngestService.pullWindowStart(stale as never, now)).toBe(
        now - CloveIngestService.PULL_WINDOW_MS,
      );
    });

    it('falls back to the totals when a payload carries no paymentStatus', () => {
      const paid = { id: 'x', shortCode: null, status: 'completed', paymentStatus: null, totalAmount: 400, amountPaid: 400 };
      expect(CloveIngestService.isPaid(paid as never)).toBe(true);
      expect(CloveIngestService.isPaid({ ...paid, amountPaid: 100 } as never)).toBe(false);
      // Nothing to judge on at all: assume unpaid rather than feed the kitchen.
      expect(CloveIngestService.isPaid({ ...paid, amountPaid: undefined } as never)).toBe(false);
    });

    it('a test order still comes through — it is created paid', async () => {
      const { service, orders } = build();
      const mapped = { mappedItems: jest.fn(async () => [{ productId: 'prod-water', cloveProductId: 'clove-water', name: 'Water' }]) };
      Object.assign((service as unknown as { clove: Record<string, unknown> }).clove, mapped);

      await service.simulateIncomingOrder(integration as never);

      expect(orders.create).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Client, round 12: "when an order comes for an order that requires
   * delivery, it still shows as dining … it doesn't go to the delivery
   * section". Cloove has no delivery service mode: the assistant leaves
   * `serviceMode` null and writes the address and the fee into the notes,
   * while charging the fee outside the line items. Every shape below is taken
   * from the merchant's own recent orders.
   */
  describe('delivery orders', () => {
    const deliveryNote = 'Delivery address: Behind customary court, the first tarred street\nDiscount code: NEW10\nDelivery fee: ₦1,000';

    it('reads a delivery out of the notes and the money', () => {
      const d = CloveIngestService.deliveryOf(cloveOrder({
        serviceMode: null,
        notes: deliveryNote,
        subtotalAmount: 3800,
        discountAmount: 760,
        totalAmount: 4040,
        items: [{ id: 'l', productId: 'p', variantId: null, productName: 'Jollof', variantName: null, quantity: 1, unitPrice: 3800, totalPrice: 3800 }],
      }) as never);

      expect(d.isDelivery).toBe(true);
      expect(d.fee).toBe(1000);
      expect(d.address).toBe('Behind customary court, the first tarred street');
    });

    it('leaves a takeaway and a dine-in alone', () => {
      const takeaway = CloveIngestService.deliveryOf(cloveOrder({
        serviceMode: 'takeaway', notes: 'Discount code: NEW10',
        subtotalAmount: 3000, discountAmount: 600, totalAmount: 2400,
      }) as never);
      const dineIn = CloveIngestService.deliveryOf(cloveOrder({
        serviceMode: 'dine_in', notes: 'Location: High level',
        subtotalAmount: 700, discountAmount: 0, totalAmount: 700,
      }) as never);

      expect(takeaway).toMatchObject({ isDelivery: false, fee: 0 });
      expect(dineIn).toMatchObject({ isDelivery: false, fee: 0 });
    });

    it('does not book a service charge as a delivery fee', () => {
      const d = CloveIngestService.deliveryOf(cloveOrder({
        serviceMode: 'dine_in', notes: null,
        subtotalAmount: 4000, discountAmount: 0, serviceChargeAmount: 500, totalAmount: 4500,
        items: [{ id: 'l', productId: 'p', variantId: null, productName: 'Jollof', variantName: null, quantity: 1, unitPrice: 4000, totalPrice: 4000 }],
      }) as never);

      expect(d).toMatchObject({ isDelivery: false, fee: 0 });
    });

    it('still finds the fee when a payload carries no totals', () => {
      const d = CloveIngestService.deliveryOf({
        id: 'x', shortCode: null, status: 'completed', paymentStatus: 'paid',
        notes: 'Delivery fee: ₦1,500',
      } as never);

      expect(d).toMatchObject({ isDelivery: true, fee: 1500 });
    });

    it('registers the order as a delivery, with the address and the fee', async () => {
      const { service, orders, orderRepo } = build({
        orders: [cloveOrder({
          serviceMode: null,
          notes: 'Delivery address: Plot 1 uke wended high level\nDelivery fee: ₦1,000',
          subtotalAmount: 400,
          discountAmount: 0,
          totalAmount: 1400,
        })],
      });

      await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      const dto = orders.create.mock.calls[0][1] as unknown as Record<string, any>;
      expect(dto.isDelivery).toBe(true);
      expect(dto.deliveryAddress).toEqual({ line1: 'Plot 1 uke wended high level' });
      // The fee Cloove charged outside the items is stamped on the row, so the
      // counter shows what the customer actually paid.
      const stamped = orderRepo.update.mock.calls.at(-1)?.[1] as unknown as Record<string, any>;
      expect(stamped.deliveryFee).toBe(1000);
      expect(stamped.total).toBe(1400);
      expect(stamped.paidAmount).toBe(1400);
    });

    it('does not invent a fee on a dine-in order', async () => {
      const { service, orders, orderRepo } = build({
        orders: [cloveOrder({ serviceMode: 'dine_in', notes: 'Location: High level' })],
      });

      await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      const dto = orders.create.mock.calls[0][1] as unknown as Record<string, any>;
      expect(dto.isDelivery).toBe(false);
      const stamped = orderRepo.update.mock.calls.at(-1)?.[1] as unknown as Record<string, any>;
      expect(stamped.deliveryFee).toBeUndefined();
      expect(stamped.paidAmount).toBe(400);
    });
  });

  /**
   * Merchant: "clove orders are Not recording under transactions which
   * automatically translates to it's absence on register and account
   * balancing, all clove transactions method should be Card."
   *
   * Two separate books were missing the sale: the register buckets orders by
   * `paymentChannel` (null belonged to no bucket), and account balancing reads
   * the transactions ledger, which was never written at all.
   */
  describe('money', () => {
    it('books the sale as card, so the register can see it', async () => {
      const { service, orderRepo } = build();

      await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      const stamped = orderRepo.update.mock.calls.at(-1)?.[1] as unknown as Record<string, any>;
      expect(stamped.paymentChannel).toBe('card');
      expect(stamped.paymentStatus).toBe('paid');
      expect(stamped.paidAmount).toBe(400);
    });

    it('writes the payment to the transactions ledger', async () => {
      const { service, orders } = build();

      await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      expect(orders.recordChannelPayment).toHaveBeenCalledWith(
        'order-100',
        { method: 'card', channelName: 'Cloove' },
      );
    });

    it('books the delivery fee with it, not just the food', async () => {
      const { service, orderRepo } = build({
        // One ₦400 line, plus the ₦1,000 delivery Cloove charges outside it.
        orders: [cloveOrder({
          subtotalAmount: 400, totalAmount: 1400, discountAmount: 0,
          notes: 'Delivery address: 1 Test Street\nDelivery fee: ₦1,000',
        })],
      });

      await service.handleWebhook(
        { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } },
        'int-1',
      );

      const stamped = orderRepo.update.mock.calls.at(-1)?.[1] as unknown as Record<string, any>;
      expect(stamped.deliveryFee).toBe(1000);
      expect(stamped.paidAmount).toBe(1400);
    });
  });

  describe('robustness', () => {
    it('two deliveries of the same new order at the same moment create one order', async () => {
      const { service, orders } = build();
      const event = { type: 'order.created', data: { entityType: 'sale', entityId: 'ord-1' } };

      const [a, b] = await Promise.all([service.handleWebhook(event, 'int-1'), service.handleWebhook(event, 'int-1')]);

      expect(orders.create).toHaveBeenCalledTimes(1);
      expect([a, b].filter((r) => (r as { duplicate?: boolean }).duplicate)).toHaveLength(1);
    });

    it('reports a channel whose key Cloove refuses once, not on every pass', async () => {
      const { service, client } = build();
      client.listOrders.mockRejectedValue(new Error('Cloove: Invalid API key') as never);
      const warn = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

      await service.pullAllEnabled();
      await service.pullAllEnabled();
      await service.pullAllEnabled();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/Invalid API key/);
    });
  });
});
