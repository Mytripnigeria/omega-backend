import { ForbiddenException } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { mockRepo } from '../../testing/mocks';

/**
 * Store linking, round 14: a workstation that has been asked to help run
 * another store's orders must be able to finish the job. Deliveries were still
 * scoped to "my own store in my own business", so a linked order could be
 * cooked here and dispatched nowhere — and the rider screen was empty.
 */
describe('DeliveriesService and linked stores', () => {
  const MINE = 'store-mine';
  const LINKED = 'store-linked';
  const STRANGER = 'store-stranger';

  const build = () => {
    const rows = [
      { id: 'd-mine', businessId: 'biz-a', storeId: MINE, orderId: 'o1', status: 'awaiting_dispatch' },
      { id: 'd-linked', businessId: 'biz-b', storeId: LINKED, orderId: 'o2', status: 'awaiting_dispatch' },
      { id: 'd-stranger', businessId: 'biz-c', storeId: STRANGER, orderId: 'o3', status: 'awaiting_dispatch' },
    ];
    const repo = mockRepo<Record<string, any>>(rows);
    const orderRepo = mockRepo<Record<string, any>>([
      { id: 'o2', businessId: 'biz-b', storeId: LINKED },
      { id: 'o3', businessId: 'biz-c', storeId: STRANGER },
    ]);
    const storeLinks = {
      accessibleStoreIds: jest.fn(async (storeId: string) =>
        storeId === MINE ? [MINE, LINKED] : [storeId],
      ),
    };
    const service = new DeliveriesService(
      repo as never,
      orderRepo as never,
      mockRepo<Record<string, any>>([]) as never,
      { record: jest.fn() } as never,
      {} as never,
      storeLinks as never,
    );
    return { service, repo, storeLinks };
  };

  const staff = (storeId: string) => ({
    sub: 'staff-1',
    sub_type: 'staff' as const,
    businessId: 'biz-a',
    storeId,
  });

  it('opens a linked store’s delivery', async () => {
    const { service } = build();

    const res = await service.findOne(staff(MINE) as never, 'd-linked');

    expect(res.id).toBe('d-linked');
  });

  it('still refuses a store nobody linked', async () => {
    const { service } = build();

    await expect(
      service.findOne(staff(MINE) as never, 'd-stranger'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('can raise a delivery for a linked store’s order', async () => {
    const { service, repo } = build();
    repo.rows.length = 0; // no delivery for that order yet

    await service.create(staff(MINE) as never, {
      orderId: 'o2', address: '1 Allen Avenue', phone: '+2348030000000',
    } as never);

    expect(repo.rows[0]).toMatchObject({ storeId: LINKED });
  });

  it('refuses to raise one for a store nobody linked', async () => {
    const { service, repo } = build();
    repo.rows.length = 0;

    await expect(
      service.create(staff(MINE) as never, {
        orderId: 'o3', address: '1 Allen Avenue', phone: '+2348030000000',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('asks for the visible stores when listing, rather than just its own', async () => {
    const { service, storeLinks, repo } = build();

    await service.findAll(staff(MINE) as never, {} as never);

    expect(storeLinks.accessibleStoreIds).toHaveBeenCalledWith(MINE);
    // The double hands out a fresh builder per call; read the one the service used.
    const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
    const qb = calls[calls.length - 1].value as { andWhere: jest.Mock };
    const clauses = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(clauses.some((c: string) => c.includes('d.storeId IN'))).toBe(true);
    // The business filter would have hidden the linked store, which belongs to
    // another merchant.
    expect(clauses.some((c: string) => c.includes('d.businessId'))).toBe(false);
  });
});
