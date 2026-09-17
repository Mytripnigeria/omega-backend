import { CloveService } from './clove.service';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Client feedback after the round-11 Cloove fix:
 *  - "just like chowdeck, it should delete products that are not on our omega
 *     menu. currently it adds ... and it also updates but it does not delete
 *     other items that are not on our omega menu."
 *
 * There is a second reason the prune matters: Cloove caps the catalogue per
 * plan (50 on this merchant's), and it was full of items that are not on the
 * Omega menu — every create was refused with "product limit reached".
 */
describe('CloveService.syncMenu — mirroring the menu', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    apiKey: 'sk_live_a',
  };

  const build = (
    products: ReturnType<typeof productFixture>[],
    opts: {
      remote?: Array<Record<string, any>>;
      mapped?: Array<Record<string, any>>;
      integrations?: Array<Record<string, any>>;
      failDelete?: string[];
      remoteCategories?: never[];
    } = {},
  ) => {
    const integrationRepo = mockRepo([integration, ...(opts.integrations ?? [])] as never[]);
    const menuMapRepo = mockRepo<Record<string, any>>(
      (opts.mapped ?? []).map((m, i) => ({ id: `map-${i}`, ...m })),
    );
    const client = {
      listAllProducts: jest.fn(async () => opts.remote ?? []),
      deleteProduct: jest.fn(async (_c: unknown, id: string) => {
        if (opts.failDelete?.includes(id)) throw new Error('Cloove: product_in_use');
      }),
      getProduct: jest.fn(async () => null),
      listCategories: jest.fn(async () => opts.remoteCategories ?? []),
      createCategory: jest.fn(async (_c: unknown, name: string) => ({ id: `cat-${name}`, name })),
      createProduct: jest.fn(async (_c: unknown, input: Record<string, any>) => ({
        id: `clove-new-${input.name}`,
        name: input.name,
      })),
      updateProduct: jest.fn(async (_c: unknown, id: string, input: Record<string, any>) => ({
        id,
        name: input.name,
      })),
    };
    const service = new CloveService(
      integrationRepo as never,
      menuMapRepo as never,
      mockRepo(products) as never,
      mockRepo([]) as never,
      client as never,
      mockRepo([]) as never,
    );
    jest.spyOn(service, 'findWithSecret').mockResolvedValue(integration as never);
    return { service, client, menuMapRepo };
  };

  const jollof = () => productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 });

  it("deletes Cloove products that are not on this store's menu", async () => {
    const { service, client } = build([jollof()], {
      remote: [
        { id: 'clove-jollof', name: 'Jollof Rice' },
        { id: 'clove-stranger', name: 'Stranger Dish' },
      ],
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.deleteProduct).toHaveBeenCalledTimes(1);
    expect(client.deleteProduct).toHaveBeenCalledWith(expect.anything(), 'clove-stranger');
    expect(client.updateProduct).toHaveBeenCalledWith(expect.anything(), 'clove-jollof', expect.anything());
    expect(res.removed).toBe(1);
    expect(res.removedNames).toEqual(['Stranger Dish']);
    expect(res.failures).toEqual([]);
  });

  it('prunes before it creates, so the freed plan slots are there for the new products', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p2', name: 'New Dish', sellingPrice: 2000 })],
      { remote: [{ id: 'clove-stranger', name: 'Stranger Dish' }] },
    );

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const deletedAt = client.deleteProduct.mock.invocationCallOrder[0];
    const createdAt = client.createProduct.mock.invocationCallOrder[0];
    expect(deletedAt).toBeLessThan(createdAt);
  });

  it("keeps Cloove's extras-only items — modifiers, which nothing on the menu replaces", async () => {
    const { service, client } = build([jollof()], {
      remote: [{ id: 'clove-extra', name: 'Extra cheese', isExtraOnly: true }],
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.deleteProduct).not.toHaveBeenCalled();
    expect(res.removed).toBe(0);
  });

  it('removes the Cloove product of an item deactivated here, and forgets its map row', async () => {
    const { service, client, menuMapRepo } = build([jollof()], {
      mapped: [{ integrationId: 'int-1', productId: 'p-old', cloveProductId: 'clove-old' }],
      remote: [
        { id: 'clove-old', name: 'Old Dish' },
        { id: 'clove-jollof', name: 'Jollof Rice' },
      ],
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.deleteProduct).toHaveBeenCalledWith(expect.anything(), 'clove-old');
    expect(menuMapRepo.rows.some((r) => r.cloveProductId === 'clove-old')).toBe(false);
    expect(res.removed).toBe(1);
    expect(res.mapped).toBe(1);
  });

  it('keeps an unpriced item that already exists on Cloove — it is on the menu, only held back', async () => {
    const { service, client } = build(
      [jollof(), productFixture({ id: 'p3', name: 'Unpriced', sellingPrice: 0 })],
      { remote: [{ id: 'clove-unpriced', name: 'Unpriced' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.deleteProduct).not.toHaveBeenCalled();
    expect(res.skippedNoPrice).toEqual(['Unpriced']);
    expect(res.adopted).toBe(1);
    expect(res.created).toBe(1);
  });

  it('never deletes what a sibling channel on the same Cloove workspace published', async () => {
    const { service, client } = build([jollof()], {
      integrations: [
        { id: 'int-2', businessId: 'biz-1', storeId: 'store-2', apiKey: 'sk_live_a' },
        { id: 'int-3', businessId: 'biz-1', storeId: 'store-3', apiKey: 'sk_live_other' },
      ],
      mapped: [
        { integrationId: 'int-2', productId: 'p-sib', cloveProductId: 'clove-sibling' },
        { integrationId: 'int-3', productId: 'p-oth', cloveProductId: 'clove-other-key' },
      ],
      remote: [
        { id: 'clove-sibling', name: 'Sibling Dish' },
        { id: 'clove-other-key', name: 'Other Key Dish' },
      ],
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    const deleted = client.deleteProduct.mock.calls.map((c) => c[1]);
    expect(deleted).not.toContain('clove-sibling');
    // A different key is a different workspace; that map says nothing about ours.
    expect(deleted).toContain('clove-other-key');
    expect(res.removedNames).toEqual(['Other Key Dish']);
  });

  it('reports a failed delete and carries on publishing', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p2', name: 'New Dish', sellingPrice: 2000 })],
      { remote: [{ id: 'clove-stranger', name: 'Stranger Dish' }], failDelete: ['clove-stranger'] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.removed).toBe(0);
    expect(res.failures).toEqual(['Remove Stranger Dish: Cloove: product_in_use']);
    expect(client.createProduct).toHaveBeenCalledTimes(1);
    expect(res.created).toBe(1);
  });

  it('does not prune when the catalogue could not be read', async () => {
    const { service, client } = build([jollof()]);
    client.listAllProducts.mockRejectedValue(new Error('Cloove timed out') as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.deleteProduct).not.toHaveBeenCalled();
    expect(res.removed).toBe(0);
    expect(res.created).toBe(1);
  });

  it('forgets a map row whose Cloove product is gone and creates the product afresh', async () => {
    const { service, client, menuMapRepo } = build([jollof()], {
      mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-gone' }],
      remote: [],
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.updateProduct).not.toHaveBeenCalled();
    expect(client.createProduct).toHaveBeenCalledTimes(1);
    expect(res.created).toBe(1);
    expect(menuMapRepo.rows.map((r) => r.cloveProductId)).toEqual(['clove-new-Jollof Rice']);
  });
});
