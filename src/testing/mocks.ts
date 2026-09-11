/**
 * Hand-rolled doubles for unit tests.
 *
 * These services are wired to TypeORM repositories and HTTP clients; the logic
 * worth testing (pricing, payload shape, reconciliation, state machines) sits
 * between them. A repository double backed by a plain array keeps the tests on
 * that logic without standing up Postgres.
 */

export interface MockRepo<T extends { id?: string }> {
  rows: T[];
  find: jest.Mock;
  findOne: jest.Mock;
  findAndCount: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  softDelete: jest.Mock;
  upsert: jest.Mock;
  count: jest.Mock;
  createQueryBuilder: jest.Mock;
}

/** Shallow `where` matching, enough for the equality filters these services use. */
const matches = <T extends Record<string, unknown>>(
  row: T,
  where: Record<string, unknown> | undefined,
): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    // `In([...])` from TypeORM arrives as an object carrying `_value`.
    if (v && typeof v === 'object' && '_value' in (v as Record<string, unknown>)) {
      const values = (v as { _value: unknown[] })._value;
      return Array.isArray(values) && values.includes(row[k]);
    }
    return row[k] === v;
  });
};

let idCounter = 0;
export const nextId = (prefix = 'id'): string => `${prefix}-${++idCounter}`;

export function mockRepo<T extends Record<string, any>>(
  initial: T[] = [],
): MockRepo<T> {
  const rows: T[] = [...initial];

  const repo: MockRepo<T> = {
    rows,
    find: jest.fn(async (opts?: { where?: Record<string, unknown> }) =>
      rows.filter((r) => matches(r, opts?.where)),
    ),
    findOne: jest.fn(
      async (opts?: { where?: Record<string, unknown> }) =>
        rows.find((r) => matches(r, opts?.where)) ?? null,
    ),
    findAndCount: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
      const hit = rows.filter((r) => matches(r, opts?.where));
      return [hit, hit.length];
    }),
    create: jest.fn((data: Partial<T>) => ({ ...data })),
    save: jest.fn(async (entity: T) => {
      const row = { ...entity } as T;
      const meta = row as Record<string, unknown>;
      if (!row.id) meta.id = nextId('row');
      // TypeORM fills @CreateDateColumn/@UpdateDateColumn on save; response
      // DTOs call .toISOString() on them, so the double has to as well.
      if (!meta.createdAt) meta.createdAt = new Date();
      meta.updatedAt = new Date();
      const at = rows.findIndex((r) => r.id === row.id);
      if (at >= 0) rows[at] = row;
      else rows.push(row);
      return row;
    }),
    update: jest.fn(
      async (where: Record<string, unknown>, patch: Partial<T>) => {
        let affected = 0;
        rows.forEach((r, i) => {
          if (matches(r, where)) {
            rows[i] = { ...r, ...patch };
            affected += 1;
          }
        });
        return { affected };
      },
    ),
    delete: jest.fn(async (where: Record<string, unknown> | string) => {
      const w = typeof where === 'string' ? { id: where } : where;
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (matches(rows[i], w)) rows.splice(i, 1);
      }
      return { affected: before - rows.length };
    }),
    softDelete: jest.fn(async (where: Record<string, unknown> | string) => {
      const w = typeof where === 'string' ? { id: where } : where;
      let affected = 0;
      rows.forEach((r, i) => {
        if (matches(r, w)) {
          rows[i] = { ...r, deletedAt: new Date() };
          affected += 1;
        }
      });
      return { affected };
    }),
    upsert: jest.fn(async (data: T | T[], conflictKeys: string[]) => {
      const incoming = Array.isArray(data) ? data : [data];
      for (const item of incoming) {
        const at = rows.findIndex((r) =>
          conflictKeys.every((k) => r[k] === (item as Record<string, unknown>)[k]),
        );
        if (at >= 0) rows[at] = { ...rows[at], ...item };
        else rows.push({ id: nextId('row'), ...item } as T);
      }
      return { identifiers: incoming };
    }),
    count: jest.fn(
      async (opts?: { where?: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, opts?.where)).length,
    ),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, unknown> = {};
      for (const m of [
        'where',
        'andWhere',
        'orWhere',
        'leftJoinAndSelect',
        'innerJoin',
        'orderBy',
        'addOrderBy',
        'skip',
        'take',
        'select',
      ]) {
        qb[m] = jest.fn(() => qb);
      }
      qb.getMany = jest.fn(async () => rows);
      qb.getManyAndCount = jest.fn(async () => [rows, rows.length]);
      qb.getOne = jest.fn(async () => rows[0] ?? null);
      return qb;
    }),
  };

  return repo;
}

/** A product shaped the way these services read it. */
export const productFixture = (over: Record<string, any> = {}) => ({
  id: over.id ?? nextId('prod'),
  storeId: 'store-1',
  businessId: 'biz-1',
  name: 'Jollof Rice',
  description: 'Smoky party jollof',
  // `price` is the COST price; `sellingPrice` is what the customer pays.
  price: 1500,
  sellingPrice: 4500,
  status: true,
  stock: 20,
  imageUrl: null,
  categoryId: 'cat-1',
  variations: [],
  addonGroups: [],
  ...over,
});
