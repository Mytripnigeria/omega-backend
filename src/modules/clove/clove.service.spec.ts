import { BadRequestException } from '@nestjs/common';
import { CloveApiError } from './clove.client';
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

/**
 * Round-12: "all update request first goes to clove, if returned successfully
 * and request is implemented, it then makes the necessary update to omega …
 * to make sure omega always shares same order conditions with what's on
 * clove." Cloove keeps prep stages on the kitchen ticket, not on the order, so
 * everything between "sent to kitchen" and "served" goes to the kitchen-status
 * endpoint.
 */
describe('CloveService.pushStatus', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    apiKey: 'sk_live',
    baseUrl: 'https://api.clooveai.com',
    isEnabled: true,
  };

  const build = (opts: { channels?: Array<Record<string, unknown>> } = {}) => {
    const rows = opts.channels ?? [integration];
    const integrationRepo = mockRepo(rows as never[]);
    const client = {
      updateKitchenStatus: jest.fn(async () => undefined),
      updateOrderStatus: jest.fn(async () => undefined),
    };
    const service = new CloveService(
      integrationRepo as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      client as never,
      mockRepo([]) as never,
    );
    jest
      .spyOn(service, 'findWithSecret')
      .mockImplementation(async (where: Record<string, unknown>) =>
        (rows.find((r) => r.id === where.id) ?? null) as never,
      );
    return { service, client };
  };

  const push = (service: CloveService, toStatus: string, reason?: string) =>
    service.pushStatus({
      storeId: 'store-1',
      externalReference: 'CLOVE-ord-1',
      toStatus,
      reason,
    });

  it('maps the workstation flow onto the two Cloove vocabularies', () => {
    expect(CloveService.cloveTargetFor('send_to_kitchen')).toEqual({ kind: 'kitchen', status: 'queued' });
    expect(CloveService.cloveTargetFor('preparing')).toEqual({ kind: 'kitchen', status: 'preparing' });
    expect(CloveService.cloveTargetFor('ready')).toEqual({ kind: 'kitchen', status: 'ready' });
    expect(CloveService.cloveTargetFor('completed')).toEqual({ kind: 'kitchen', status: 'served' });
    expect(CloveService.cloveTargetFor('served')).toEqual({ kind: 'kitchen', status: 'served' });
    expect(CloveService.cloveTargetFor('cancelled')).toEqual({ kind: 'order', status: 'cancelled' });
    // Accepting tells Cloove nothing it does not already know.
    expect(CloveService.cloveTargetFor('pending')).toBeNull();
    expect(CloveService.cloveTargetFor('initiated')).toBeNull();
  });

  it('sends Accept nowhere', async () => {
    const { service, client } = build();

    await push(service, 'pending');

    expect(client.updateKitchenStatus).not.toHaveBeenCalled();
    expect(client.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('sends Send-to-kitchen as a queued kitchen ticket', async () => {
    const { service, client } = build();

    await push(service, 'send_to_kitchen');

    expect(client.updateKitchenStatus).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk_live' }),
      'ord-1',
      'queued',
      expect.any(String),
    );
  });

  it('cancels the order itself, with the reason staff gave', async () => {
    const { service, client } = build();

    await push(service, 'cancelled', 'Out of stock');

    expect(client.updateOrderStatus).toHaveBeenCalledWith(
      expect.anything(),
      'ord-1',
      'cancelled',
      'Out of stock',
    );
    expect(client.updateKitchenStatus).not.toHaveBeenCalled();
  });

  it('throws when Cloove refuses, so the local order is left alone', async () => {
    const { service, client } = build();
    client.updateKitchenStatus.mockRejectedValue(
      new Error('Cloove: This order has no associated kitchen ticket') as never,
    );

    await expect(push(service, 'preparing')).rejects.toThrow(/no associated kitchen ticket/);
  });

  it('names what to do about an order Cloove never sent to its kitchen', async () => {
    const { service, client } = build();
    client.updateKitchenStatus.mockRejectedValue(
      new Error('Cloove: This order has no associated kitchen ticket') as never,
    );

    const err = await push(service, 'ready').catch((e: Error) => e);

    expect((err as Error).message).toMatch(/send_to_kitchen/);
  });

  it('points staff at Cloove when Cloove will not take the cancellation', async () => {
    const { service, client } = build();
    // Cloove refuses this for an order it collected by automated transfer.
    client.updateOrderStatus.mockRejectedValue(
      new CloveApiError(
        'Completed automated bank transfer orders cannot be cancelled',
        422,
      ) as never,
    );

    const err = await push(service, 'cancelled', 'Out of stock').catch((e: Error) => e);

    expect((err as Error).message).toMatch(/cancel or refund this order in Cloove/i);
  });

  it('reports the real refusal, not a stray channel whose key is wrong', async () => {
    // The merchant's store carries a channel saved with a webhook secret in
    // place of the API key; it answers 401 to everything.
    const broken = { ...integration, id: 'int-broken' };
    const { service, client } = build({ channels: [broken, integration] });
    client.updateKitchenStatus
      .mockRejectedValueOnce(new CloveApiError('Invalid API key', 401) as never)
      .mockRejectedValueOnce(
        new CloveApiError('This order has no associated kitchen ticket', 404) as never,
      );

    const err = await push(service, 'ready').catch((e: Error) => e);

    expect((err as Error).message).toMatch(/kitchen ticket/);
    expect((err as Error).message).not.toMatch(/Invalid API key/);
  });

  it('does not trap an order Cloove has never heard of', async () => {
    const { service, client } = build();
    // The hub's rehearsal order lives only on our counter, and a channel the
    // merchant replaced leaves real orders behind the same way.
    client.updateKitchenStatus.mockRejectedValue(
      new CloveApiError('Order not found', 404) as never,
    );

    await expect(push(service, 'ready')).resolves.toBeUndefined();
  });

  it('still refuses when the order exists but has no kitchen ticket', async () => {
    const { service, client } = build();
    client.updateKitchenStatus.mockRejectedValue(
      new CloveApiError('This order has no associated kitchen ticket', 404) as never,
    );

    await expect(push(service, 'ready')).rejects.toThrow(/kitchen ticket/);
  });

  it('tries every channel on the store before giving up — only one knows the order', async () => {
    const second = { ...integration, id: 'int-2' };
    const { service, client } = build({ channels: [integration, second] });
    client.updateKitchenStatus
      .mockRejectedValueOnce(new Error('Cloove: Order not found') as never)
      .mockResolvedValueOnce(undefined as never);

    await expect(push(service, 'ready')).resolves.toBeUndefined();
    expect(client.updateKitchenStatus).toHaveBeenCalledTimes(2);
  });

  it('does not strand a counter whose merchant disconnected Cloove', async () => {
    const { service, client } = build({ channels: [] });

    await expect(push(service, 'ready')).resolves.toBeUndefined();
    expect(client.updateKitchenStatus).not.toHaveBeenCalled();
  });
});
