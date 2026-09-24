import { NotFoundException } from '@nestjs/common';
import { WorkstationSettingsService } from './workstation-settings.service';

/**
 * Round-13: "All workstation settings should be fixed/about a particular store
 * id not general business id."
 *
 * Splitting one business record into one per store raises two questions this
 * covers: what a branch opened tomorrow starts from, and who may read a
 * branch's setup.
 */
type Row = Record<string, unknown>;

const makeRepo = (rows: Row[] = []) => ({
  rows,
  findOne: jest.fn(({ where, order }: any) => {
    const match = rows.filter((r) =>
      Object.entries(where).every(([k, v]) => r[k] === v),
    );
    if (order?.createdAt === 'ASC') {
      match.sort(
        (a, b) =>
          new Date(a.createdAt as string).getTime() -
          new Date(b.createdAt as string).getTime(),
      );
    }
    return Promise.resolve(match[0] ?? null);
  }),
  create: jest.fn((v: Row) => v),
  // The service reaches for the business's FIRST store through a join, so the
  // stub resolves the same way: settings ordered by their store's createdAt.
  createQueryBuilder: jest.fn(() => {
    let businessId = '';
    const qb: Record<string, unknown> = {
      innerJoin: () => qb,
      where: (_c: string, params: { businessId: string }) => {
        businessId = params.businessId;
        return qb;
      },
      orderBy: () => qb,
      getOne: () =>
        Promise.resolve(
          rows
            .filter((r) => r.businessId === businessId)
            .sort(
              (a, b) =>
                new Date(a.storeCreatedAt as string).getTime() -
                new Date(b.storeCreatedAt as string).getTime(),
            )[0] ?? null,
        ),
    };
    return qb;
  }),
  save: jest.fn((v: Row) => {
    rows.push(v);
    return Promise.resolve(v);
  }),
  find: jest.fn(() => Promise.resolve([])),
  delete: jest.fn(() => Promise.resolve({})),
});

const makeService = (settings: Row[], stores: Row[]) => {
  const repo = makeRepo(settings);
  const geofenceRepo = makeRepo([]);
  const storeRepo = {
    findOne: jest.fn(({ where }: any) =>
      Promise.resolve(
        stores.find((s) => s.id === where.id && s.businessId === where.businessId) ??
          null,
      ),
    ),
  };
  const service = new WorkstationSettingsService(
    repo as never,
    geofenceRepo as never,
    storeRepo as never,
    { findOne: jest.fn() } as never,
    { findOne: jest.fn() } as never,
    { record: jest.fn() } as never,
  );
  return { service, repo, geofenceRepo, storeRepo };
};

const STORES = [
  { id: 'store-1', businessId: 'biz-1' },
  { id: 'store-2', businessId: 'biz-1' },
  { id: 'store-x', businessId: 'biz-2' },
];

describe('WorkstationSettingsService', () => {
  it('gives a store its own record on first read', async () => {
    const { service, repo } = makeService([], STORES);

    await service.get('biz-1', 'store-1');

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1', businessId: 'biz-1' }),
    );
  });

  it('starts a new branch from the first branch, not from bare defaults', async () => {
    const founding = {
      storeId: 'store-1',
      businessId: 'biz-1',
      pinLength: 6,
      autoAcceptOrders: true,
      functionRoleAccess: { managers: ['Manager'] },
      updatedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-06-01T00:00:00Z',
      storeCreatedAt: '2026-01-01T00:00:00Z',
    };
    // Its settings row was written first (someone opened that screen earlier)
    // and it was edited more recently — neither makes it the branch a new one
    // should copy. Only the order the branches opened in does.
    const edited = {
      storeId: 'store-9',
      businessId: 'biz-1',
      pinLength: 4,
      autoAcceptOrders: false,
      functionRoleAccess: null,
      updatedAt: '2026-09-20T00:00:00Z',
      createdAt: '2026-02-01T00:00:00Z',
      storeCreatedAt: '2026-05-01T00:00:00Z',
    };
    const { service, repo } = makeService([founding, edited], STORES);

    await service.get('biz-1', 'store-2');

    const created = repo.save.mock.calls[0][0] as Row;
    expect(created.storeId).toBe('store-2');
    expect(created.pinLength).toBe(6);
    expect(created.autoAcceptOrders).toBe(true);
    // A restriction the merchant set deliberately must not be dropped.
    expect(created.functionRoleAccess).toEqual({ managers: ['Manager'] });
    // ...but it is a record of its own, not a copy of the sibling's identity.
    expect(created.createdAt).toBeUndefined();
    expect(created.updatedAt).toBeUndefined();
  });

  it('refuses a store that belongs to another business', async () => {
    const { service } = makeService([], STORES);

    await expect(service.get('biz-1', 'store-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('will not hand one business the function access of another', async () => {
    const { service } = makeService(
      [{ storeId: 'store-x', businessId: 'biz-2', functionRoleAccess: { kitchen: ['Chef'] } }],
      STORES,
    );

    // storeId arrives as a query parameter, so the business must be checked.
    await expect(service.getFunctionAccess('biz-1', 'store-x')).resolves.toEqual({
      functionRoleAccess: null,
    });
    await expect(service.getFunctionAccess('biz-2', 'store-x')).resolves.toEqual({
      functionRoleAccess: { kitchen: ['Chef'] },
    });
  });

  it('answers an admin who names no store instead of querying for one', async () => {
    const { service, repo } = makeService([], STORES);

    await expect(service.getFunctionAccess('biz-1', '')).resolves.toEqual({
      functionRoleAccess: null,
    });
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
