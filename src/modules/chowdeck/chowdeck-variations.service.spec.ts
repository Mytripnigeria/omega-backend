import { ChowdeckClient } from './chowdeck.client';
import { ChowdeckService } from './chowdeck.service';
import { mockRepo, productFixture } from '../../testing/mocks';

/**
 * Round-11 feedback, Chowdeck:
 *  - "'Publish menu' doesn't create/set/update product variations on chowdeck
 *     menu when adding/updating menu items"
 *
 * Variations go up as `modifiers` on the bulk upload — which acknowledges only
 * the item references it accepted, so the publish itself cannot tell you
 * whether the groups were made. Chowdeck exposes the groups for reading, but
 * on a different host: `studio-api.chowdeck.com`, not `api.chowdeck.com`.
 * Asking the write host returns nothing, which looks exactly like "the
 * variations never landed".
 */
describe('Chowdeck variation publishing', () => {
  describe('host routing', () => {
    const endpointOf = (client: ChowdeckClient, creds: Record<string, any>, path: string, host?: string) =>
      (client as never as {
        endpoint: (c: unknown, p: string, h?: string) => string;
      }).endpoint(creds, path, host);

    const client = new ChowdeckClient();
    const creds = { merchantReference: 'MERCH-1', secretKey: 'sk' };

    it('writes to the api host', () => {
      expect(endpointOf(client, creds, '/menu/bulk-upload')).toBe(
        'https://api.chowdeck.com/merchant/MERCH-1/menu/bulk-upload',
      );
    });

    it('reads menu groups from the studio host', () => {
      expect(endpointOf(client, creds, '/menu-group', 'studio')).toBe(
        'https://studio-api.chowdeck.com/merchant/MERCH-1/menu-group',
      );
    });

    it('follows a configured sandbox host across to its studio counterpart', () => {
      const sandbox = { ...creds, baseUrl: 'https://api.sandbox.chowdeck.com' };
      expect(endpointOf(client, sandbox, '/menu-group', 'studio')).toBe(
        'https://studio-api.sandbox.chowdeck.com/merchant/MERCH-1/menu-group',
      );
    });

    it('falls back to the studio host when the override has no api. prefix', () => {
      const odd = { ...creds, baseUrl: 'https://chowdeck.internal' };
      expect(endpointOf(client, odd, '/menu-group', 'studio')).toBe(
        'https://studio-api.chowdeck.com/merchant/MERCH-1/menu-group',
      );
    });
  });

  describe('publish reporting', () => {
    const integration = {
      id: 'int-1',
      businessId: 'biz-1',
      storeId: 'store-1',
      apiKey: 'sk',
      merchantReference: 'MERCH-1',
    } as never;

    const build = (products: ReturnType<typeof productFixture>[]) => {
      const client = {
        listMenu: jest.fn(async () => []),
        bulkUploadMenu: jest.fn(async (_c: unknown, items: unknown[]) => items),
        listMenuGroups: jest.fn(async () => []),
      };
      const service = new ChowdeckService(
        mockRepo([integration as never]) as never,
        mockRepo([]) as never,
        mockRepo(products) as never,
        mockRepo<Record<string, any>>([{ id: 'cat-1', name: 'Rice', order: 1 }]) as never,
        mockRepo([]) as never,
        client as never,
      );
      jest.spyOn(service, 'findWithSecret').mockResolvedValue(integration as never);
      jest
        .spyOn(service, 'rebuildMenuMap')
        .mockResolvedValue({ mapped: products.length, unmapped: [] } as never);
      return { service, client };
    };

    const withVariations = () =>
      productFixture({
        name: 'Jollof Rice',
        sellingPrice: 4500,
        variations: [
          { id: 'v1', name: 'Small', sellingPrice: 3000 },
          { id: 'v2', name: 'Large', sellingPrice: 6000 },
        ],
      });

    it('counts the variation groups it sent', async () => {
      const { service } = build([withVariations(), productFixture({ sellingPrice: 1000 })]);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.variationsSent).toBe(1);
    });

    it('counts add-on groups alongside variations', async () => {
      const { service } = build([
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

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.variationsSent).toBe(2);
    });

    it('reads the groups back from Chowdeck and reports how many are live', async () => {
      const { service, client } = build([withVariations()]);
      client.listMenuGroups.mockResolvedValue([
        { id: 1, name: 'Options', items: [] },
        { id: 2, name: 'Extras', items: [] },
      ] as never);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(client.listMenuGroups).toHaveBeenCalled();
      expect(res.variationGroupsLive).toBe(2);
    });

    it('reports zero live groups distinctly from an unanswered check', async () => {
      const { service, client } = build([withVariations()]);
      client.listMenuGroups.mockResolvedValue([] as never);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.variationGroupsLive).toBe(0);
    });

    it('reports null — not zero — when the check itself could not run', async () => {
      // "We could not ask" must never be presented as "there are none".
      const { service, client } = build([withVariations()]);
      client.listMenuGroups.mockRejectedValue(new Error('403 Forbidden') as never);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.variationGroupsLive).toBeNull();
    });

    it('does not fail the publish when the read-back fails', async () => {
      const { service, client } = build([withVariations()]);
      client.listMenuGroups.mockRejectedValue(new Error('studio host down') as never);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.published).toBe(1);
      expect(client.bulkUploadMenu).toHaveBeenCalled();
    });

    it('sends no modifier group for a product with neither variations nor add-ons', async () => {
      const { service } = build([productFixture({ sellingPrice: 1000 })]);

      const res = await service.syncMenu('biz-1', 'store-1', 'int-1');

      expect(res.variationsSent).toBe(0);
    });
  });
});
