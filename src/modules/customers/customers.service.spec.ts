import { CustomersService } from './customers.service';
import { CustomerSource } from './entities/customer.entity';
import { mockRepo } from '../../testing/mocks';

/**
 * Round-11 feedback, "Through the test order i noticed":
 *  - "Customer is not added to customers page/section/database, Name, phone
 *     number, email etc."
 *
 * Marketplace orders used to store the buyer as two text columns on the order
 * row, so they never reached the customers list and repeat orders from the same
 * phone never accumulated against one record.
 */
describe('CustomersService.findOrCreateFromChannel', () => {
  const build = (existing: Record<string, any>[] = []) => {
    const customerRepo = mockRepo<Record<string, any>>(existing);
    // findByEmailOrPhone goes through a query builder; resolve it against the
    // same rows so the double behaves like the real lookup.
    customerRepo.createQueryBuilder.mockImplementation(() => {
      const filters: Array<(r: Record<string, any>) => boolean> = [];
      const qb: Record<string, any> = {
        where: (_sql: string, params: Record<string, any>) => {
          filters.push((r) => r.businessId === params.businessId);
          return qb;
        },
        andWhere: (sql: string, params: Record<string, any>) => {
          filters.push((r) => {
            const byEmail = params.email !== undefined && r.email === params.email;
            const byPhone = params.phone !== undefined && r.phone === params.phone;
            return sql.includes('OR') ? byEmail || byPhone : byEmail || byPhone;
          });
          return qb;
        },
        getOne: async () =>
          customerRepo.rows.find((r) => filters.every((f) => f(r))) ?? null,
      };
      return qb;
    });

    const service = new CustomersService(
      customerRepo as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      {} as never,
      { record: jest.fn() } as never,
      {} as never,
    );
    return { service, customerRepo };
  };

  it('creates a customer row carrying the name, phone and email from the order', async () => {
    const { service, customerRepo } = build();

    const res = await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze Okonkwo',
      email: 'adaeze@example.com',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });

    expect(res).toBeTruthy();
    expect(customerRepo.rows).toHaveLength(1);
    expect(customerRepo.rows[0]).toMatchObject({
      businessId: 'biz-1',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      email: 'adaeze@example.com',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });
  });

  it('tags the originating marketplace so the customers list can show it', async () => {
    const { service, customerRepo } = build();

    await service.findOrCreateFromChannel('biz-1', {
      name: 'Chinedu Eze',
      phone: '+2348030000303',
      source: CustomerSource.CLOVE,
    });

    expect(customerRepo.rows[0].source).toBe(CustomerSource.CLOVE);
  });

  it('reuses the existing customer when the same phone orders again', async () => {
    const { service, customerRepo } = build([
      {
        id: 'cust-1',
        businessId: 'biz-1',
        firstName: 'Adaeze',
        lastName: 'Okonkwo',
        phone: '+2348030000101',
        email: null,
      },
    ]);

    const res = await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze Okonkwo',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });

    expect(res?.id).toBe('cust-1');
    expect(customerRepo.rows).toHaveLength(1);
  });

  it('backfills an email onto a customer first seen by phone', async () => {
    const { service, customerRepo } = build([
      {
        id: 'cust-1',
        businessId: 'biz-1',
        firstName: 'Adaeze',
        lastName: 'Okonkwo',
        phone: '+2348030000101',
        email: null,
      },
    ]);

    await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze Okonkwo',
      phone: '+2348030000101',
      email: 'adaeze@example.com',
      source: CustomerSource.CHOWDECK,
    });

    expect(customerRepo.rows[0].email).toBe('adaeze@example.com');
    expect(customerRepo.rows).toHaveLength(1);
  });

  it('does not leak a customer across businesses', async () => {
    const { service, customerRepo } = build([
      {
        id: 'cust-other',
        businessId: 'biz-OTHER',
        phone: '+2348030000101',
        email: null,
      },
    ]);

    const res = await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze Okonkwo',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });

    expect(res?.id).not.toBe('cust-other');
    expect(customerRepo.rows).toHaveLength(2);
  });

  it('returns null rather than creating an anonymous row with no contact detail', async () => {
    const { service, customerRepo } = build();

    const res = await service.findOrCreateFromChannel('biz-1', {
      name: 'Walk-in',
      email: null,
      phone: null,
      source: CustomerSource.CHOWDECK,
    });

    expect(res).toBeNull();
    expect(customerRepo.rows).toHaveLength(0);
  });

  it('handles a single-word name without losing the record', async () => {
    const { service, customerRepo } = build();

    await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });

    expect(customerRepo.rows[0]).toMatchObject({
      firstName: 'Adaeze',
      lastName: '-',
    });
  });

  it('survives a concurrent insert of the same customer', async () => {
    const { service, customerRepo } = build();
    // Simulate the unique index firing, then the winning row appearing.
    customerRepo.save.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint') as never,
    );
    customerRepo.rows.push({
      id: 'cust-winner',
      businessId: 'biz-1',
      phone: '+2348030000101',
      email: null,
    });

    const res = await service.findOrCreateFromChannel('biz-1', {
      name: 'Adaeze Okonkwo',
      phone: '+2348030000101',
      source: CustomerSource.CHOWDECK,
    });

    expect(res?.id).toBe('cust-winner');
  });
});
