import { BadRequestException } from '@nestjs/common';
import { ChowdeckService, toKobo } from './chowdeck.service';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Round-11 feedback, Chowdeck menu publishing:
 *  - "'Publish menu' doesn't create/set/update product variations"
 *  - "Test orders come with '0' Naira amounts" (the ₦0 cause is here: an
 *    unpriced product used to be published at zero)
 */
describe('ChowdeckService.syncMenu', () => {
  const integration = {
    id: 'int-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    label: 'Main branch',
    apiKey: 'sk_test',
    merchantReference: 'MERCH-1',
  } as never;

  const build = (products: ReturnType<typeof productFixture>[]) => {
    const integrationRepo = mockRepo([integration as never]);
    const menuMapRepo = mockRepo([]);
    const productRepo = mockRepo(products);
    const categoryRepo = mockRepo([
      { id: 'cat-1', name: 'Rice dishes', order: 1 } as never,
    ]);
    const storeRepo = mockRepo([]);
    const client = {
      listMenu: jest.fn(async () => []),
      bulkUploadMenu: jest.fn(async (_c: unknown, items: unknown[]) => items),
    };
    const service = new ChowdeckService(
      integrationRepo as never,
      menuMapRepo as never,
      productRepo as never,
      categoryRepo as never,
      storeRepo as never,
      client as never,
    );
    jest
      .spyOn(service, 'findWithSecret')
      .mockResolvedValue(integration as never);
    jest
      .spyOn(service, 'rebuildMenuMap')
      .mockResolvedValue({ mapped: products.length, unmapped: [], menu: [] } as never);
    return { service, client, integrationRepo };
  };

  const publishedItems = (client: { bulkUploadMenu: jest.Mock }) =>
    client.bulkUploadMenu.mock.calls[0][1] as Array<Record<string, any>>;

  it('publishes the selling price, never the cost price', async () => {
    const { service, client } = build([
      productFixture({ name: 'Jollof Rice', price: 1500, sellingPrice: 4500 }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const [item] = publishedItems(client);
    expect(item.price).toBe(toKobo(4500));
    expect(item.price).not.toBe(toKobo(1500));
  });

  it('holds back unpriced products instead of listing them free', async () => {
    const { service, client } = build([
      productFixture({ name: 'Jollof Rice', sellingPrice: 4500 }),
      productFixture({ name: 'Unpriced Special', sellingPrice: 0 }),
    ]);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    const names = publishedItems(client).map((i) => i.name);
    expect(names).toEqual(['Jollof Rice']);
    expect(res.skippedNoPrice).toEqual(['Unpriced Special']);
    expect(publishedItems(client).every((i) => i.price > 0)).toBe(true);
  });

  it('refuses the whole publish when nothing has a price', async () => {
    const { service, client } = build([
      productFixture({ name: 'Unpriced', sellingPrice: 0 }),
    ]);

    await expect(service.syncMenu('biz-1', 'store-1', 'int-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(client.bulkUploadMenu).not.toHaveBeenCalled();
  });

  it('sends variations as a single-choice modifier group priced as differences', async () => {
    // Chowdeck adds a modifier's price on top of the item price, so a sized
    // product is listed at its cheapest size and each size carries only the
    // difference — sending full prices (as this used to) doubled the bill.
    const { service, client } = build([
      productFixture({
        name: 'Jollof Rice',
        sellingPrice: 4500,
        variations: [
          { id: 'var-s', name: 'Small', sellingPrice: 3000 },
          { id: 'var-l', name: 'Large', sellingPrice: 6000 },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const [item] = publishedItems(client);
    expect(item.price).toBe(toKobo(3000));
    expect(item.modifiers).toHaveLength(1);
    const [group] = item.modifiers;
    expect(group).toMatchObject({
      name: 'Options',
      minimum_selection: 1,
      maximum_selection: 1,
    });
    expect(group.items).toEqual([
      { name: 'Small', price: 0, reference: 'var-s' },
      { name: 'Large', price: toKobo(3000), reference: 'var-l' },
    ]);
  });

  it('charges exactly the size price once a size is picked', async () => {
    const { service, client } = build([
      productFixture({
        name: 'Chicken Shawarma',
        sellingPrice: 3000,
        variations: [
          { id: 'v-s', name: 'Small', sellingPrice: 3000 },
          { id: 'v-m', name: 'Medium', sellingPrice: 3400 },
          { id: 'v-b', name: 'Big', sellingPrice: 3800 },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const [item] = publishedItems(client);
    const sizePrice: Record<string, number> = { Small: 3000, Medium: 3400, Big: 3800 };
    for (const opt of item.modifiers[0].items as Array<{ name: string; price: number }>) {
      const charged = item.price + opt.price;
      expect(charged).toBe(toKobo(sizePrice[opt.name]));
    }
  });

  it('publishes a product priced only through its sizes', async () => {
    const { service, client } = build([
      productFixture({
        name: 'Parfait',
        sellingPrice: 0,
        variations: [
          { id: 'v1', name: 'Regular', sellingPrice: 4000 },
          { id: 'v2', name: 'Large', sellingPrice: 5500 },
        ],
      }),
    ]);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.skippedNoPrice).toEqual([]);
    expect(publishedItems(client)[0].price).toBe(toKobo(4000));
  });

  it('never sends a negative size price', async () => {
    const { service, client } = build([
      productFixture({
        sellingPrice: 9000,
        variations: [
          { id: 'v1', name: 'Small', sellingPrice: 9000 },
          { id: 'v2', name: 'Mini', sellingPrice: 7000 },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const [item] = publishedItems(client);
    expect(item.price).toBe(toKobo(7000));
    expect(item.modifiers[0].items.every((o: { price: number }) => o.price >= 0)).toBe(true);
  });

  it('sends add-on groups with their own selection bounds, skipping unavailable add-ons', async () => {
    const { service, client } = build([
      productFixture({
        name: 'Jollof Rice',
        sellingPrice: 4500,
        addonGroups: [
          {
            id: 'grp-1',
            name: 'Proteins',
            minSelection: 0,
            maxSelection: 2,
            addons: [
              { id: 'add-1', name: 'Chicken', price: 1500, isAvailable: true },
              { id: 'add-2', name: 'Goat meat', price: 2000, isAvailable: false },
            ],
          },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const [group] = publishedItems(client)[0].modifiers;
    expect(group).toMatchObject({
      name: 'Proteins',
      minimum_selection: 0,
      maximum_selection: 2,
    });
    expect(group.items).toEqual([
      { name: 'Chicken', price: toKobo(1500), reference: 'add-1' },
    ]);
  });

  it('publishes variations and add-ons together on one item', async () => {
    const { service, client } = build([
      productFixture({
        sellingPrice: 4500,
        variations: [{ id: 'v1', name: 'Large', sellingPrice: 6000 }],
        addonGroups: [
          {
            id: 'g1',
            name: 'Extras',
            minSelection: 0,
            maxSelection: 1,
            addons: [{ id: 'a1', name: 'Plantain', price: 800, isAvailable: true }],
          },
        ],
      }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    const names = publishedItems(client)[0].modifiers.map(
      (m: { name: string }) => m.name,
    );
    expect(names).toEqual(['Options', 'Extras']);
  });

  it('reports what the replace-style bulk upload removed', async () => {
    const { service, client } = build([
      productFixture({ id: 'p-keep', name: 'Jollof Rice', sellingPrice: 4500 }),
    ]);
    client.listMenu.mockResolvedValue([
      { reference: 'p-keep', name: 'Jollof Rice' },
      { reference: 'p-gone', name: 'Retired Special' },
    ] as never);

    const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(res.replacedItems).toEqual(['Retired Special']);
  });

  it('sends the entire catalogue in one call, because bulk upload replaces the menu', async () => {
    const { service, client } = build([
      productFixture({ name: 'A', sellingPrice: 1000 }),
      productFixture({ name: 'B', sellingPrice: 2000 }),
      productFixture({ name: 'C', sellingPrice: 3000 }),
    ]);

    await service.syncMenu('biz-1', 'store-1', 'int-1');

    expect(client.bulkUploadMenu).toHaveBeenCalledTimes(1);
    expect(publishedItems(client)).toHaveLength(3);
  });
});
