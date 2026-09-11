import { BadRequestException } from '@nestjs/common';
import { CloveService } from './clove.service';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Round-11 feedback, CloveAI:
 *  - "Doesn't update menu on clove, although the notification says it did but
 *     with an error note below the settings modal saying 22 failed: ….."
 *
 * Cloove enforces unique product names per business and offers no
 * external-reference field, so anything the merchant built in Cloove directly
 * is invisible to our map — and creating it again is what produced "22 failed".
 */
describe('CloveService.syncMenu', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    apiKey: 'sk_live',
  } as never;

  const build = (
    products: ReturnType<typeof productFixture>[],
    opts: { remote?: Array<{ id: string; name: string }>; mapped?: unknown[] } = {},
  ) => {
    const integrationRepo = mockRepo([integration as never]);
    const menuMapRepo = mockRepo((opts.mapped ?? []) as never[]);
    const productRepo = mockRepo(products);
    const storeRepo = mockRepo([]);
    const client = {
      listAllProducts: jest.fn(async () => opts.remote ?? []),
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
      productRepo as never,
      storeRepo as never,
      client as never,
    );
    jest.spyOn(service, 'findWithSecret').mockResolvedValue(integration as never);
    return { service, client, menuMapRepo };
  };

  it('adopts a product that already exists on Cloove instead of creating a duplicate', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 })],
      { remote: [{ id: 'clove-existing-1', name: 'Jollof Rice' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct).not.toHaveBeenCalled();
    expect(client.updateProduct).toHaveBeenCalledWith(
      expect.anything(),
      'clove-existing-1',
      expect.objectContaining({ name: 'Jollof Rice' }),
    );
    expect(res.adopted).toBe(1);
    expect(res.updated).toBe(1);
    expect(res.created).toBe(0);
    expect(res.failures).toEqual([]);
  });

  it('matches on a normalised name, so punctuation and case do not defeat it', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Chicken & Chips', sellingPrice: 3000 })],
      { remote: [{ id: 'clove-1', name: 'chicken and chips' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    // "chicken and chips" normalises differently from "chicken chips", so this
    // one is a genuine miss and must be created rather than wrongly adopted.
    expect(res.adopted).toBe(0);
    expect(client.createProduct).toHaveBeenCalled();
  });

  it('adopts across case and spacing differences', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Jollof  RICE', sellingPrice: 4500 })],
      { remote: [{ id: 'clove-1', name: 'jollof rice' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.adopted).toBe(1);
    expect(client.createProduct).not.toHaveBeenCalled();
  });

  it('creates only what Cloove genuinely does not have', async () => {
    const { service, client } = build(
      [
        productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 }),
        productFixture({ id: 'p2', name: 'Brand New Dish', sellingPrice: 2000 }),
      ],
      { remote: [{ id: 'clove-1', name: 'Jollof Rice' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.adopted).toBe(1);
    expect(res.created).toBe(1);
    expect(res.updated).toBe(1);
    expect(client.createProduct).toHaveBeenCalledTimes(1);
    expect(client.createProduct.mock.calls[0][1]).toMatchObject({
      name: 'Brand New Dish',
    });
  });

  it('falls back to creating when the catalogue read fails, rather than aborting the publish', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 })],
      {},
    );
    client.listAllProducts.mockRejectedValue(new Error('Cloove timed out') as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.adopted).toBe(0);
    expect(res.created).toBe(1);
    expect(res.failures).toEqual([]);
  });

  it('reports per-product failures instead of claiming success', async () => {
    const { service, client } = build([
      productFixture({ id: 'p1', name: 'Good One', sellingPrice: 1000 }),
      productFixture({ id: 'p2', name: 'Bad One', sellingPrice: 2000 }),
    ]);
    client.createProduct.mockImplementation(async (_c: unknown, input: Record<string, any>) => {
      if (input.name === 'Bad One') throw new Error('name already taken');
      return { id: 'clove-ok', name: input.name };
    });

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.created).toBe(1);
    expect(res.failures).toEqual(['Bad One: name already taken']);
  });

  it('sends the selling price in naira, not the cost price and not kobo', async () => {
    const { service, client } = build([
      productFixture({ id: 'p1', name: 'Jollof Rice', price: 1500, sellingPrice: 4500 }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct.mock.calls[0][1]).toMatchObject({ price: 4500 });
  });

  it('publishes variations as Cloove variants priced in naira', async () => {
    const { service, client } = build([
      productFixture({
        id: 'p1',
        name: 'Jollof Rice',
        sellingPrice: 4500,
        variations: [
          { id: 'v1', name: 'Small', sellingPrice: 3000, sku: 'JR-S' },
          { id: 'v2', name: 'Large', sellingPrice: 6000 },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct.mock.calls[0][1].variants).toEqual([
      { name: 'Small', price: 3000, sku: 'JR-S' },
      { name: 'Large', price: 6000 },
    ]);
  });

  it('holds back unpriced products so nothing is listed free', async () => {
    const { service, client } = build([
      productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 }),
      productFixture({ id: 'p2', name: 'Unpriced', sellingPrice: 0 }),
    ]);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.skippedNoPrice).toEqual(['Unpriced']);
    expect(client.createProduct).toHaveBeenCalledTimes(1);
  });

  it('refuses the publish outright when nothing is priced', async () => {
    const { service, client } = build([
      productFixture({ id: 'p1', name: 'Unpriced', sellingPrice: 0 }),
    ]);

    await expect(service.syncMenu('biz-1', 'store-1', 'int-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(client.createProduct).not.toHaveBeenCalled();
  });

  it('updates through the stored map without re-reading the catalogue', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 })],
      { mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-known' }] },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.listAllProducts).not.toHaveBeenCalled();
    expect(client.updateProduct).toHaveBeenCalledWith(
      expect.anything(),
      'clove-known',
      expect.anything(),
    );
    expect(res.updated).toBe(1);
  });
});
