import { BadRequestException } from '@nestjs/common';
import { ChowdeckIngestService } from './chowdeck-ingest.service';
import { toKobo } from './chowdeck.service';
import { CustomerSource } from '../customers/entities/customer.entity';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Round-11 feedback, "Through the test order i noticed":
 *  - customer name and phone should come with the order, not "Chowdeck Test"
 *  - test orders come with ₦0 amounts
 *  - delivery orders carry no address or rider information
 *  - the customer is never added to the customers database
 */
describe('ChowdeckIngestService.simulateIncomingOrder', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    label: 'Main branch',
    autoAccept: false,
  } as never;

  const jollof = productFixture({
    id: 'prod-jollof',
    name: 'Jollof Rice',
    price: 1500,
    sellingPrice: 4500,
  });
  const suya = productFixture({
    id: 'prod-suya',
    name: 'Suya Skewers',
    price: 900,
    sellingPrice: 2500,
  });

  const build = (opts: { mapped?: unknown[]; products?: unknown[] } = {}) => {
    const orderRepo = mockRepo([]);
    const productRepo = mockRepo((opts.products ?? [jollof, suya]) as never[]);
    const chowdeck = {
      mappedMenuItems: jest.fn(async () =>
        opts.mapped ?? [
          { productId: 'prod-jollof', chowdeckMenuId: '9001', name: 'Jollof Rice' },
          { productId: 'prod-suya', chowdeckMenuId: '9002', name: 'Suya Skewers' },
        ],
      ),
      productIdForMenuId: jest.fn(async (_i: string, menuId: number | string) =>
        String(menuId) === '9001' ? 'prod-jollof' : 'prod-suya',
      ),
      findWithSecret: jest.fn(async () => integration),
    };
    const client = { getOrder: jest.fn() };

    const created = {
      id: 'order-1',
      orderNumber: 'ORD-0001',
      total: 0,
    };
    const orders = {
      create: jest.fn(async (_actor: unknown, dto: Record<string, any>) => {
        created.total = (dto.items as Array<Record<string, number>>).reduce(
          (sum, l) => sum + l.unitPrice * l.quantity,
          0,
        );
        return { ...created };
      }),
      updateStatus: jest.fn(),
    };
    const customers = {
      findOrCreateFromChannel: jest.fn(async () => ({ id: 'cust-1' })),
    };

    const service = new ChowdeckIngestService(
      orderRepo as never,
      productRepo as never,
      chowdeck as never,
      client as never,
      orders as never,
      customers as never,
    );
    return { service, orderRepo, orders, customers, chowdeck };
  };

  const dtoOf = (orders: { create: jest.Mock }) =>
    orders.create.mock.calls[0][1] as Record<string, any>;

  it('names the real customer and carries their phone and email', async () => {
    const { service, orders, customers } = build();

    await service.simulateIncomingOrder(integration);

    const dto = dtoOf(orders);
    expect(dto.customerName).toBe('Adaeze Okonkwo');
    expect(dto.customerName).not.toMatch(/chowdeck test/i);
    expect(dto.customerPhone).toBe('+2348030000101');
    expect(customers.findOrCreateFromChannel).toHaveBeenCalledWith('biz-1', {
      name: 'Adaeze Okonkwo',
      email: 'adaeze.okonkwo@chowdeck-test.example',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });
  });

  it('prices every line from the real selling price, never ₦0 and never the cost', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    const lines = dtoOf(orders).items as Array<Record<string, any>>;
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.unitPrice > 0)).toBe(true);
    const jollofLine = lines.find((l) => l.name === 'Jollof Rice');
    expect(jollofLine?.unitPrice).toBe(4500);
    expect(jollofLine?.unitPrice).not.toBe(1500);
    // First mapped line is quantity 2, so the order totals to something real.
    const total = lines.reduce((s: number, l) => s + l.unitPrice * l.quantity, 0);
    expect(total).toBe(4500 * 2 + 2500);
  });

  it('carries the delivery address', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    const dto = dtoOf(orders);
    expect(dto.isDelivery).toBe(true);
    expect(dto.deliveryAddress).toMatchObject({
      line1: '14 Adeola Odeku Street, Victoria Island',
      city: 'Lagos',
      state: 'Lagos',
    });
    expect(dto.deliveryAddress.latitude).toBeCloseTo(6.4281);
    expect(dto.deliveryAddress.longitude).toBeCloseTo(3.4216);
  });

  it('records the rider name and phone on the order row', async () => {
    const { service, orderRepo } = build();

    await service.simulateIncomingOrder(integration);

    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch).toMatchObject({
      riderName: 'Musa Ibrahim',
      riderPhone: '+2348030000202',
    });
  });

  it('marks the order paid for the full amount', async () => {
    const { service, orderRepo } = build();

    await service.simulateIncomingOrder(integration);

    const [, patch] = orderRepo.update.mock.calls[0];
    expect(patch.paymentStatus).toBe('paid');
    expect(patch.paidAmount).toBe(4500 * 2 + 2500);
    expect(patch.paidAt).toBeInstanceOf(Date);
  });

  it('links the order to the customer record it created', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    expect(dtoOf(orders).customerId).toBe('cust-1');
  });

  it('still creates the order when the customer cannot be registered', async () => {
    const { service, orders, customers } = build();
    customers.findOrCreateFromChannel.mockResolvedValue(null as never);

    await service.simulateIncomingOrder(integration);

    const dto = dtoOf(orders);
    expect(dto).not.toHaveProperty('customerId');
    expect(dto.customerName).toBe('Adaeze Okonkwo');
  });

  it('refuses to fabricate an order when no product is mapped', async () => {
    const { service, orders } = build({ mapped: [] });

    await expect(service.simulateIncomingOrder(integration)).rejects.toThrow(
      BadRequestException,
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('notes the delivery fee as Chowdeck\'s, not the merchant\'s revenue', async () => {
    const { service, orders } = build();

    await service.simulateIncomingOrder(integration);

    expect(dtoOf(orders).notes).toContain('paid to Chowdeck');
  });

  it('is idempotent — a repeat reference never creates a second order', async () => {
    const { service, orderRepo, orders } = build();
    orderRepo.rows.push({
      id: 'order-existing',
      orderNumber: 'ORD-0009',
      externalReference: 'TEST-DUP',
    } as never);

    const res = await service.simulateIncomingOrder(integration, {
      reference: 'TEST-DUP',
    });

    expect(res).toMatchObject({ duplicate: true, orderId: 'order-existing' });
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('prices lines in naira even though Chowdeck quotes kobo', async () => {
    const { service, orders, chowdeck } = build();
    chowdeck.mappedMenuItems.mockResolvedValue([
      { productId: 'prod-jollof', chowdeckMenuId: '9001', name: 'Jollof Rice' },
    ] as never);

    await service.simulateIncomingOrder(integration);

    const [line] = dtoOf(orders).items as Array<Record<string, number>>;
    // 4500 naira → 450000 kobo on the wire → 4500 naira on our order line.
    expect(toKobo(4500)).toBe(450000);
    expect(line.unitPrice).toBe(4500);
  });
});
