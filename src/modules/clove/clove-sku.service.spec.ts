import { CloveService } from './clove.service';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Production, round-11 re-test: 21 of 50 products failed every Cloove publish
 * with "An unexpected error occurred". The catalogue reuses SKUs — a product
 * and its Small variant share one, two pizzas share three — and Cloove keeps
 * SKUs unique per workspace, answering a collision with that bare message.
 */
describe('CloveService SKU collisions', () => {
  const integration = { id: 'int-1', businessId: 'biz-1', storeId: 'store-1', apiKey: 'sk' } as never;

  const build = (products: ReturnType<typeof productFixture>[], opts: { failOnSku?: boolean } = {}) => {
    const client = {
      listAllProducts: jest.fn(async () => []),
      createProduct: jest.fn(async (_c: unknown, input: Record<string, any>) => {
        const carriesSku = !!input.sku || (input.variants ?? []).some((v: { sku?: string }) => v.sku);
        if (opts.failOnSku && carriesSku) throw new Error('Cloove: An unexpected error occurred. Please try again.');
        return { id: `clove-${input.name}`, name: input.name };
      }),
      updateProduct: jest.fn(async (_c: unknown, id: string, input: Record<string, any>) => ({ id, name: input.name })),
    };
    const service = new CloveService(
      mockRepo([integration as never]) as never,
      mockRepo([]) as never,
      mockRepo(products) as never,
      mockRepo([]) as never,
      client as never,
    );
    jest.spyOn(service, 'findWithSecret').mockResolvedValue(integration as never);
    return { service, client };
  };

  const sent = (client: { createProduct: jest.Mock }, name: string) =>
    client.createProduct.mock.calls.map((c) => c[1]).find((i) => i.name === name);

  it('drops a SKU shared by a product and its own variant', async () => {
    const { service, client } = build([
      productFixture({
        id: 'p1', name: 'Hollandia', sku: 'HLD001', sellingPrice: 1000,
        variations: [{ id: 'v1', name: 'Small', sellingPrice: 1000, sku: 'HLD001' }],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const input = sent(client, 'Hollandia');
    expect(input.sku).toBeUndefined();
    expect(input.variants[0].sku).toBeUndefined();
  });

  it('drops a SKU shared across two products, keeps the unique ones', async () => {
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
    expect(sent(client, 'Coconut-Chicken Pizza').variants.map((v: { sku?: string }) => v.sku)).toEqual([undefined, 'CCP-BIG']);
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
    client.createProduct.mockRejectedValue(new Error('Cloove: An unexpected error occurred.') as never);

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
});
