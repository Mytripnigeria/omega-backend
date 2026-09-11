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
