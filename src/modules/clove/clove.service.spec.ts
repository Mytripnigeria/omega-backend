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
    opts: {
      remote?: Array<Record<string, any>>;
      mapped?: unknown[];
      categories?: Array<{ id: string; name: string }>;
      remoteCategories?: Array<{ id: string; name: string }>;
    } = {},
  ) => {
    const integrationRepo = mockRepo([integration as never]);
    const menuMapRepo = mockRepo((opts.mapped ?? []) as never[]);
    const productRepo = mockRepo(products);
    const storeRepo = mockRepo([]);
    const client = {
      listAllProducts: jest.fn(async () => opts.remote ?? []),
      deleteProduct: jest.fn(async () => undefined),
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
      productRepo as never,
      storeRepo as never,
      client as never,
      mockRepo((opts.categories ?? []) as never[]) as never,
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
      { name: 'Small', price: 3000, sku: 'JR-S', stock_quantity: 20 },
      { name: 'Large', price: 6000, stock_quantity: 20 },
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

  it('updates through the stored map, reading the catalogue once to mirror it', async () => {
    const { service, client } = build(
      [productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500 })],
      {
        mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-known' }],
        remote: [{ id: 'clove-known', name: 'Jollof Rice' }],
      },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.listAllProducts).toHaveBeenCalledTimes(1);
    expect(client.updateProduct).toHaveBeenCalledWith(
      expect.anything(),
      'clove-known',
      expect.anything(),
    );
    expect(res.updated).toBe(1);
    expect(res.adopted).toBe(0);
  });

  /**
   * Client feedback after the first fix: "it adds (without some items like
   * image, sku, stock level)". Cloove's write API is snake_case; the camelCase
   * fields sent before were silently dropped.
   */
  describe('image, SKU and stock', () => {
    it('sends the image, SKU and stock Cloove needs, in snake_case', async () => {
      const { service, client } = build([
        productFixture({
          id: 'p1',
          name: 'Jollof Rice',
          sellingPrice: 4500,
          sku: 'JOL001',
          stock: 25,
          imageUrl: 'https://cdn.example/jollof.jpg',
        }),
      ]);

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.createProduct.mock.calls[0][1]).toMatchObject({
        name: 'Jollof Rice',
        price: 4500,
        sku: 'JOL001',
        quantity: 25,
        image_urls: ['https://cdn.example/jollof.jpg'],
        is_active: true,
      });
    });

    it('sends no image field when the product has none, rather than an empty list', async () => {
      const { service, client } = build([
        productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500, imageUrl: null }),
      ]);

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.createProduct.mock.calls[0][1]).not.toHaveProperty('image_urls');
    });

    it('moves stock through store_inventory on an update, since Cloove ignores quantity there', async () => {
      const { service, client } = build(
        [productFixture({ id: 'p1', name: 'Jollof Rice', sellingPrice: 4500, stock: 25 })],
        {
          mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-known' }],
          remote: [{ id: 'clove-known', name: 'Jollof Rice', stores: [{ id: 'st-1' }, { id: 'st-2' }] }],
        },
      );

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      const sent = client.updateProduct.mock.calls[0][2];
      expect(sent.store_inventory).toEqual([
        { store_id: 'st-1', stock_quantity: 25 },
        { store_id: 'st-2', stock_quantity: 25 },
      ]);
      expect(sent).not.toHaveProperty('quantity');
    });

    it('carries Cloove variant ids across an update so sizes are corrected, not recreated', async () => {
      const { service, client } = build(
        [
          productFixture({
            id: 'p1',
            name: 'Pizza',
            sellingPrice: 9000,
            variations: [
              { id: 'v1', name: 'Small', sellingPrice: 9000, stock: 5 },
              { id: 'v2', name: 'Large', sellingPrice: 12000, stock: 0 },
            ],
          }),
        ],
        {
          mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-pizza' }],
          remote: [
            {
              id: 'clove-pizza',
              name: 'Pizza',
              variants: [{ id: 'cv-small', name: 'small', sku: null, price: '9000.00' }],
            },
          ],
        },
      );

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.updateProduct.mock.calls[0][2].variants).toEqual([
        { id: 'cv-small', name: 'Small', price: 9000, stock_quantity: 5 },
        // Large is new on Cloove (no id) and, having no stock of its own,
        // sells from the product's stock.
        { name: 'Large', price: 12000, stock_quantity: 20 },
      ]);
    });

    it('treats a product priced only through its sizes as priced, at the cheapest size', async () => {
      const { service, client } = build([
        productFixture({
          id: 'p1',
          name: 'Shawarma',
          sellingPrice: 0,
          variations: [
            { id: 'v1', name: 'Large', sellingPrice: 6000 },
            { id: 'v2', name: 'Small', sellingPrice: 3000 },
          ],
        }),
      ]);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.skippedNoPrice).toEqual([]);
      expect(client.createProduct.mock.calls[0][1]).toMatchObject({ price: 3000 });
    });
  });

  /**
   * Client, after the mirror went live: "noticed some categories are showing
   * general instead of the correct category". Cloove files anything published
   * without `category_id` under General.
   */
  describe('categories', () => {
    const drinks = { id: 'cat-omega-drinks', name: 'Drinks' };

    it('files the product under the Cloove category of the same name', async () => {
      const { service, client } = build(
        [productFixture({ id: 'p1', name: 'Coke', sellingPrice: 700, categoryId: drinks.id })],
        { categories: [drinks], remoteCategories: [{ id: 'clove-cat-drinks', name: 'drinks' }] },
      );

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.createCategory).not.toHaveBeenCalled();
      expect(client.createProduct.mock.calls[0][1]).toMatchObject({ category_id: 'clove-cat-drinks' });
    });

    it('creates a missing category once and files every product under it', async () => {
      const { service, client } = build(
        [
          productFixture({ id: 'p1', name: 'Coke', sellingPrice: 700, categoryId: drinks.id }),
          productFixture({ id: 'p2', name: 'Fanta', sellingPrice: 700, categoryId: drinks.id }),
        ],
        { categories: [drinks], remoteCategories: [] },
      );

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.createCategory).toHaveBeenCalledTimes(1);
      expect(client.createCategory).toHaveBeenCalledWith(expect.anything(), 'Drinks');
      for (const call of client.createProduct.mock.calls) {
        expect(call[1]).toMatchObject({ category_id: 'cat-Drinks' });
      }
      expect(res.categoriesCreated).toBe(1);
    });

    it('sends no category for a product that has none here', async () => {
      const { service, client } = build([
        productFixture({ id: 'p1', name: 'Coke', sellingPrice: 700, categoryId: null }),
      ]);

      await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.createProduct.mock.calls[0][1]).not.toHaveProperty('category_id');
    });

    it('still publishes when the categories cannot be read, just without them', async () => {
      const { service, client } = build(
        [productFixture({ id: 'p1', name: 'Coke', sellingPrice: 700, categoryId: drinks.id })],
        { categories: [drinks] },
      );
      client.listCategories.mockRejectedValue(new Error('Cloove timed out') as never);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.created).toBe(1);
      expect(client.createProduct.mock.calls[0][1]).not.toHaveProperty('category_id');
    });
  });
});
