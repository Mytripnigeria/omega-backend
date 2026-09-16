import { CloveService } from './clove.service';
import { CloveApiError } from './clove.client';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Production, round-11 re-test: 21 of 50 products failed every Cloove publish
 * with "An unexpected error occurred". The catalogue reuses SKUs — a product
 * and its Small variant share one, two pizzas share three — and Cloove keeps
 * SKUs unique per workspace, answering a collision with that bare message.
 * Each SKU therefore goes out once, with its first holder; a product with sizes
 * leaves the SKU to the size, because Cloove pins a product-level SKU to the
 * default variant — which a product with sizes does not have.
 */
describe('CloveService SKU collisions', () => {
  const integration = { id: 'int-1', businessId: 'biz-1', storeId: 'store-1', apiKey: 'sk' } as never;

  const build = (
    products: ReturnType<typeof productFixture>[],
    opts: { failOnSku?: boolean; remote?: Array<Record<string, any>>; mapped?: Array<Record<string, any>>; deadSkus?: string[] } = {},
  ) => {
    const dead = (input: Record<string, any>) =>
      [input.sku, ...(input.variants ?? []).map((v: { sku?: string }) => v.sku)].some((s) => s && opts.deadSkus?.includes(s));
    const client = {
      listAllProducts: jest.fn(async () => opts.remote ?? []),
      deleteProduct: jest.fn(async () => undefined),
      getProduct: jest.fn(async () => null),
      createProduct: jest.fn(async (_c: unknown, input: Record<string, any>) => {
        const carriesSku = !!input.sku || (input.variants ?? []).some((v: { sku?: string }) => v.sku);
        if (opts.failOnSku && carriesSku) throw new CloveApiError('An unexpected error occurred. Please try again.', 500);
        return { id: `clove-${input.name}`, name: input.name };
      }),
      updateProduct: jest.fn(async (_c: unknown, id: string, input: Record<string, any>) => {
        if (dead(input)) throw new CloveApiError('An unexpected error occurred. Please try again.', 500);
        return { id, name: input.name };
      }),
    };
    const service = new CloveService(
      mockRepo([integration as never]) as never,
      mockRepo((opts.mapped ?? []) as never[]) as never,
      mockRepo(products) as never,
      mockRepo([]) as never,
      client as never,
    );
    jest.spyOn(service, 'findWithSecret').mockResolvedValue(integration as never);
    return { service, client };
  };

  const sent = (client: { createProduct: jest.Mock }, name: string) =>
    client.createProduct.mock.calls.map((c) => c[1]).find((i) => i.name === name);

  it('gives a SKU shared by a product and its own size to the size', async () => {
    const { service, client } = build([
      productFixture({
        id: 'p1', name: 'Hollandia', sku: 'HLD001', sellingPrice: 1000,
        variations: [{ id: 'v1', name: 'Small', sellingPrice: 1000, sku: 'HLD001' }],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const input = sent(client, 'Hollandia');
    expect(input.sku).toBeUndefined();
    expect(input.variants[0].sku).toBe('HLD001');
  });

  it('sends a SKU shared across two products once, with its first holder', async () => {
    const { service, client } = build([
      productFixture({
        id: 'p1', name: 'Coconut-Chicken Pizza', sku: 'CPZ001', sellingPrice: 9000,
        variations: [
          { id: 'v1', name: 'Small', sellingPrice: 9000, sku: 'CPZ001' },
          { id: 'v2', name: 'Big', sellingPrice: 11000, sku: 'CCP-BIG' },
        ],
      }),
      productFixture({ id: 'p2', name: 'Chicken Pizza', sku: 'CPZ001', sellingPrice: 8000 }),
      productFixture({ id: 'p3', name: 'Sausage', sku: 'SSG001', sellingPrice: 500 }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(sent(client, 'Coconut-Chicken Pizza').sku).toBeUndefined();
    expect(sent(client, 'Coconut-Chicken Pizza').variants.map((v: { sku?: string }) => v.sku)).toEqual(['CPZ001', 'CCP-BIG']);
    expect(sent(client, 'Chicken Pizza').sku).toBeUndefined();
    expect(sent(client, 'Sausage').sku).toBe('SSG001');
  });

  it('retries once without any SKU when Cloove rejects a SKU it already holds', async () => {
    // "Sausage" has a unique SKU in OUR catalogue but collides with a product
    // that exists only on Cloove — nothing on our side can predict that.
    const { service, client } = build(
      [productFixture({ id: 'p3', name: 'Sausage', sku: 'SSG001', sellingPrice: 500 })],
      { failOnSku: true },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct).toHaveBeenCalledTimes(2);
    expect(client.createProduct.mock.calls[0][1].sku).toBe('SSG001');
    expect(client.createProduct.mock.calls[1][1].sku).toBeUndefined();
    expect(res.created).toBe(1);
    expect(res.failures).toEqual([]);
  });

  it('reports the failure when the retry without SKUs also fails', async () => {
    const { service, client } = build([
      productFixture({ id: 'p3', name: 'Sausage', sku: 'SSG001', sellingPrice: 500 }),
    ]);
    client.createProduct.mockRejectedValue(new CloveApiError('An unexpected error occurred.', 500) as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct).toHaveBeenCalledTimes(2);
    expect(res.failures).toEqual(['Sausage: Cloove: An unexpected error occurred.']);
  });

  it('does not retry a product that carried no SKU to begin with', async () => {
    const { service, client } = build([
      productFixture({ id: 'p4', name: 'Water', sku: null, sellingPrice: 200 }),
    ]);
    client.createProduct.mockRejectedValue(new Error('Cloove: nope') as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct).toHaveBeenCalledTimes(1);
    expect(res.failures).toEqual(['Water: Cloove: nope']);
  });

  /**
   * Live finding: Cloove keeps a soft-deleted product's SKU reserved, so a SKU
   * can be refused although nothing visible holds it. The retry must then
   * drop only what is new, not every SKU the product had.
   */
  it('keeps the SKUs already live on the product and drops only the refused one', async () => {
    const { service, client } = build(
      [
        productFixture({
          id: 'p1', name: 'Beef Burger', sku: 'BBG001', sellingPrice: 4500,
          variations: [
            { id: 'v1', name: 'Double', sellingPrice: 4500, sku: 'BBG002' },
            { id: 'v2', name: 'Single', sellingPrice: 3000, sku: 'BBG001' },
          ],
        }),
      ],
      {
        mapped: [{ integrationId: 'int-1', productId: 'p1', cloveProductId: 'clove-bb' }],
        remote: [{ id: 'clove-bb', name: 'Beef Burger', variants: [{ id: 'cv-d', name: 'Double', sku: 'BBG002', price: '4500.00' }] }],
        deadSkus: ['BBG001'],
      },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.updateProduct).toHaveBeenCalledTimes(2);
    const retry = client.updateProduct.mock.calls[1][2];
    expect(retry.variants.map((v: { sku?: string }) => v.sku)).toEqual(['BBG002', undefined]);
    expect(res.failures).toEqual([]);
    expect(res.skuConflicts).toEqual(['Beef Burger: BBG001']);
  });

  it('reports every SKU a product was published without', async () => {
    const { service } = build(
      [productFixture({ id: 'p3', name: 'Sausage', sku: 'SSG001', sellingPrice: 500 })],
      { failOnSku: true },
    );

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.skuConflicts).toEqual(['Sausage: SSG001']);
  });

  it('does not treat a rate limit (or any non-500) as a SKU collision', async () => {
    const { service, client } = build([
      productFixture({ id: 'p3', name: 'Sausage', sku: 'SSG001', sellingPrice: 500 }),
    ]);
    client.createProduct.mockRejectedValue(new CloveApiError('Too many requests.', 429) as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.createProduct).toHaveBeenCalledTimes(1);
    expect(res.skuConflicts).toEqual([]);
    expect(res.failures).toEqual(['Sausage: Cloove: Too many requests.']);
  });
});
