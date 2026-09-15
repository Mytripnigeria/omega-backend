import { OrderResponseDto } from './dto/order-response.dto';

/**
 * Round-11: "Delivery orders do not come with ... rider information". The
 * rider columns were added and written on ingest, but the response DTO is
 * built with `excludeExtraneousValues`, so an un-exposed field never left the
 * server — the dashboard's Delivery tab could only say "assign a rider".
 */
describe('OrderResponseDto rider fields', () => {
  const base = {
    id: 'o1',
    orderNumber: 3810,
    status: 'initiated',
    channel: 'chowdeck',
    isDelivery: true,
    customerName: 'Adaeze Okonkwo',
    customerPhone: '+2348030000101',
    deliveryAddress: { line1: '14 Adeola Odeku Street', city: 'Lagos' },
    riderName: 'Musa Ibrahim',
    riderPhone: '+2348030000202',
    items: [],
    total: 4300,
    subtotal: 4300,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;

  it('carries the rider name and phone to the dashboard', () => {
    const dto = OrderResponseDto.from(base);
    expect(dto.riderName).toBe('Musa Ibrahim');
    expect(dto.riderPhone).toBe('+2348030000202');
  });

  it('keeps the address alongside', () => {
    const dto = OrderResponseDto.from(base);
    expect(dto.deliveryAddress).toMatchObject({ city: 'Lagos' });
  });

  it('serialises nulls for an order with no rider', () => {
    const dto = OrderResponseDto.from({ ...(base as object), riderName: null, riderPhone: null } as never);
    expect(dto.riderName).toBeNull();
    expect(dto.riderPhone).toBeNull();
  });
});
