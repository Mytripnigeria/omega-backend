import { ExpenseResponseDto } from './dto/expense-response.dto';

/**
 * Round-11 feedback, Operations (Expenses):
 *  - "Expenses doesn't show the lists of items on the merchant dashboard, the
 *     details of the expenses record as inputted via workstation"
 *
 * The line items are stored on the expense row as jsonb. The response DTO is
 * built with `excludeExtraneousValues`, so an un-`@Expose()`d field is silently
 * dropped on the way to the dashboard — which is exactly how a record entered
 * on the workstation can arrive with its detail missing.
 */
describe('ExpenseResponseDto', () => {
  const entity = {
    id: 'exp-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    amount: '12500.00',
    currency: 'NGN',
    description: 'Market run',
    supplierName: 'Mile 12 Market',
    items: [
      {
        name: 'Tomatoes',
        type: 'ingredient',
        unit: 'basket',
        quantity: 2,
        unitPrice: 5000,
        total: 10000,
        supplier: 'Mile 12 Market',
      },
      {
        name: 'Pepper',
        type: 'ingredient',
        unit: 'bag',
        quantity: 1,
        unitPrice: 2500,
        total: 2500,
        supplier: 'Mile 12 Market',
      },
    ],
  } as never;

  it('carries the line items through to the dashboard', () => {
    const dto = ExpenseResponseDto.from(entity);

    expect(dto.items).toHaveLength(2);
    expect(dto.items?.[0]).toMatchObject({
      name: 'Tomatoes',
      quantity: 2,
      unitPrice: 5000,
      total: 10000,
    });
  });

  it('keeps every detail a workstation submission captures', () => {
    const dto = ExpenseResponseDto.from(entity);

    // unit and supplier are what make the list readable to a merchant who
    // wasn't there when it was entered.
    expect(dto.items?.[0].unit).toBe('basket');
    expect(dto.items?.[0].supplier).toBe('Mile 12 Market');
    expect(dto.items?.[1].name).toBe('Pepper');
  });

  it('returns the amount as a number, not the string Postgres hands back', () => {
    const dto = ExpenseResponseDto.from(entity);

    expect(dto.amount).toBe(12500);
    expect(typeof dto.amount).toBe('number');
  });

  it('tolerates an expense with no line items', () => {
    const dto = ExpenseResponseDto.from({ ...(entity as never as object), items: null } as never);

    expect(dto.items).toBeNull();
    expect(dto.description).toBe('Market run');
  });

  it('maps a list without dropping items from any row', () => {
    const rows = ExpenseResponseDto.fromMany([entity, entity]);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.items?.length === 2)).toBe(true);
  });
});
