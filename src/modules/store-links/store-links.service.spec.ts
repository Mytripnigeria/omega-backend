import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StoreLinksService } from './store-links.service';
import { StoreLinkStatus } from './entities/store-link.entity';
import { mockRepo } from '../../testing/mocks';

/**
 * Round-11 feedback, Workstation (Settings):
 *  - a workstation should be able to link other stores by entering a store id,
 *    which sends a request for that business to approve or decline
 *  - "i currently cannot find where one can send the request ... manage the
 *    connection eg. Update & delete"
 */
describe('StoreLinksService', () => {
  const ownStore = { id: 'store-a', businessId: 'biz-a', name: 'Ikeja branch' };
  const otherStore = { id: 'store-b', businessId: 'biz-b', name: 'Lekki branch' };

  const build = (links: Record<string, unknown>[] = []) => {
    const repo = mockRepo<Record<string, any>>(links);
    const storeRepo = mockRepo<Record<string, any>>([ownStore, otherStore]);
    const activityLog = { record: jest.fn() };
    const service = new StoreLinksService(
      repo as never,
      storeRepo as never,
      activityLog as never,
    );
    return { service, repo, activityLog };
  };

  describe('request', () => {
    it('creates a pending request against the target store', async () => {
      const { service, repo } = build();

      const res = await service.request('biz-a', 'store-a', {
        targetStoreId: 'store-b',
        message: 'We cover your evening rush',
      } as never);

      expect(res).toMatchObject({
        requesterStoreId: 'store-a',
        targetStoreId: 'store-b',
        status: StoreLinkStatus.PENDING,
      });
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({ targetBusinessId: 'biz-b' });
    });

    it('resolves both store names so the merchant sees who is asking', async () => {
      const { service } = build();

      const res = await service.request('biz-a', 'store-a', {
        targetStoreId: 'store-b',
      } as never);

      expect(res.requesterStoreName).toBe('Ikeja branch');
      expect(res.targetStoreName).toBe('Lekki branch');
    });

    it('rejects a store linking to itself', async () => {
      const { service } = build();

      await expect(
        service.request('biz-a', 'store-a', { targetStoreId: 'store-a' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown store id', async () => {
      const { service } = build();

      await expect(
        service.request('biz-a', 'store-a', { targetStoreId: 'nope' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to stack a second request while one is pending', async () => {
      const { service } = build([
        {
          id: 'link-1',
          requesterStoreId: 'store-a',
          targetStoreId: 'store-b',
          status: StoreLinkStatus.PENDING,
        },
      ]);

      await expect(
        service.request('biz-a', 'store-a', { targetStoreId: 'store-b' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a request to a store already linked', async () => {
      const { service } = build([
        {
          id: 'link-1',
          requesterStoreId: 'store-a',
          targetStoreId: 'store-b',
          status: StoreLinkStatus.APPROVED,
        },
      ]);

      await expect(
        service.request('biz-a', 'store-a', { targetStoreId: 'store-b' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('lets a declined link be asked for again', async () => {
      const { service, repo } = build([
        {
          id: 'link-1',
          requesterStoreId: 'store-a',
          requesterBusinessId: 'biz-a',
          targetStoreId: 'store-b',
          targetBusinessId: 'biz-b',
          status: StoreLinkStatus.DECLINED,
          respondedAt: new Date(),
        },
      ]);

      const res = await service.request('biz-a', 'store-a', {
        targetStoreId: 'store-b',
      } as never);

      expect(res.status).toBe(StoreLinkStatus.PENDING);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].respondedAt).toBeNull();
    });
  });

  describe('respond', () => {
    const pending = {
      id: 'link-1',
      requesterStoreId: 'store-a',
      requesterBusinessId: 'biz-a',
      targetStoreId: 'store-b',
      targetBusinessId: 'biz-b',
      status: StoreLinkStatus.PENDING,
    };

    it('approves a request addressed to this business', async () => {
      const { service } = build([{ ...pending }]);

      const res = await service.respond(
        'biz-b',
        'link-1',
        { status: StoreLinkStatus.APPROVED } as never,
        'admin-1',
        'Owner',
      );

      expect(res.status).toBe(StoreLinkStatus.APPROVED);
      expect(res.respondedAt).toBeTruthy();
    });

    it('declines a request', async () => {
      const { service } = build([{ ...pending }]);

      const res = await service.respond(
        'biz-b',
        'link-1',
        { status: StoreLinkStatus.DECLINED } as never,
        'admin-1',
        'Owner',
      );

      expect(res.status).toBe(StoreLinkStatus.DECLINED);
    });

    it('hides a request belonging to another business', async () => {
      const { service } = build([{ ...pending }]);

      await expect(
        service.respond(
          'biz-somebody-else',
          'link-1',
          { status: StoreLinkStatus.APPROVED } as never,
          'admin-1',
          'Owner',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to answer the same request twice', async () => {
      const { service } = build([
        { ...pending, status: StoreLinkStatus.APPROVED },
      ]);

      await expect(
        service.respond(
          'biz-b',
          'link-1',
          { status: StoreLinkStatus.DECLINED } as never,
          'admin-1',
          'Owner',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revoke', () => {
    const approved = {
      id: 'link-1',
      requesterStoreId: 'store-a',
      requesterBusinessId: 'biz-a',
      targetStoreId: 'store-b',
      targetBusinessId: 'biz-b',
      status: StoreLinkStatus.APPROVED,
    };

    it('lets the requester give up its own access', async () => {
      const { service, repo } = build([{ ...approved }]);

      await service.revoke({ id: 'link-1', businessId: 'biz-a', storeId: 'store-a' });

      expect(repo.rows[0].status).toBe(StoreLinkStatus.REVOKED);
    });

    it('lets the target withdraw access it granted', async () => {
      const { service, repo } = build([{ ...approved }]);

      await service.revoke({ id: 'link-1', businessId: 'biz-b' });

      expect(repo.rows[0].status).toBe(StoreLinkStatus.REVOKED);
    });

    it('refuses an unrelated business', async () => {
      const { service, repo } = build([{ ...approved }]);

      await expect(
        service.revoke({ id: 'link-1', businessId: 'biz-c' }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.rows[0].status).toBe(StoreLinkStatus.APPROVED);
    });
  });

  describe('accessibleStoreIds', () => {
    it('returns own store plus approved targets only', async () => {
      const { service } = build([
        {
          id: 'l1',
          requesterStoreId: 'store-a',
          targetStoreId: 'store-b',
          status: StoreLinkStatus.APPROVED,
        },
        {
          id: 'l2',
          requesterStoreId: 'store-a',
          targetStoreId: 'store-c',
          status: StoreLinkStatus.PENDING,
        },
        {
          id: 'l3',
          requesterStoreId: 'store-a',
          targetStoreId: 'store-d',
          status: StoreLinkStatus.REVOKED,
        },
      ]);

      expect(await service.accessibleStoreIds('store-a')).toEqual([
        'store-a',
        'store-b',
      ]);
    });

    it('degrades to the workstation\'s own store when the table is unavailable', async () => {
      const { service, repo } = build([]);
      repo.find.mockRejectedValue(
        new Error('relation "store_links" does not exist') as never,
      );

      // A cashier must still be able to sell if the migration has not run.
      expect(await service.accessibleStoreIds('store-a')).toEqual(['store-a']);
    });
  });
});
