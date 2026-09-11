import { BadRequestException } from '@nestjs/common';
import { ChowdeckService } from './chowdeck.service';
import { mockRepo } from '../../testing/mocks';

/**
 * Round-11 feedback, Chowdeck:
 *  - "Adding additional channel saves but replaces the former, it should show
 *     all added"
 *
 * A store may sell through several Chowdeck vendor listings. Saving the form
 * must edit the channel in hand; only an explicit "add" creates another.
 */
describe('ChowdeckService channels', () => {
  const store = { id: 'store-1', businessId: 'biz-1', name: 'Ikeja' };

  const build = (channels: Record<string, any>[] = []) => {
    const integrationRepo = mockRepo<Record<string, any>>(channels);
    const service = new ChowdeckService(
      integrationRepo as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo<Record<string, any>>([store]) as never,
      {} as never,
    );
    jest
      .spyOn(service, 'findWithSecret')
      .mockImplementation(async (where: Record<string, any>) =>
        (integrationRepo.rows.find((r) => r.id === where.id) ?? null) as never,
      );
    return { service, integrationRepo };
  };

  const channel = (over: Record<string, any> = {}) => ({
    id: 'chan-1',
    businessId: 'biz-1',
    storeId: 'store-1',
    merchantReference: 'MERCH-1',
    label: 'Ikeja listing',
    secretKey: 'sk_1',
    webhookToken: 'tok-1',
    isEnabled: true,
    createdAt: new Date('2026-01-01'),
    ...over,
  });

  it('adds a second channel when the merchant explicitly asks to', async () => {
    const { service, integrationRepo } = build([channel()]);

    await service.upsertConfig('biz-1', 'store-1', {
      merchantReference: 'MERCH-2',
      label: 'Lekki listing',
      secretKey: 'sk_2',
      createNew: true,
    } as never);

    expect(integrationRepo.rows).toHaveLength(2);
    expect(integrationRepo.rows.map((r) => r.merchantReference)).toEqual([
      'MERCH-1',
      'MERCH-2',
    ]);
  });

  it('lists every channel the store has', async () => {
    const { service } = build([
      channel(),
      channel({ id: 'chan-2', merchantReference: 'MERCH-2', label: 'Lekki' }),
    ]);

    const rows = await service.listChannels('biz-1', 'store-1');

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.label)).toEqual(['Ikeja listing', 'Lekki']);
  });

  it('edits the only channel rather than spawning a second one', async () => {
    const { service, integrationRepo } = build([channel()]);

    await service.upsertConfig('biz-1', 'store-1', {
      label: 'Renamed',
    } as never);

    expect(integrationRepo.rows).toHaveLength(1);
    expect(integrationRepo.rows[0].label).toBe('Renamed');
  });

  it('edits the named channel and leaves its sibling untouched', async () => {
    const { service, integrationRepo } = build([
      channel(),
      channel({ id: 'chan-2', merchantReference: 'MERCH-2', label: 'Lekki' }),
    ]);

    await service.upsertConfig(
      'biz-1',
      'store-1',
      { label: 'Lekki renamed' } as never,
      'chan-2',
    );

    expect(integrationRepo.rows).toHaveLength(2);
    expect(integrationRepo.rows[0].label).toBe('Ikeja listing');
    expect(integrationRepo.rows[1].label).toBe('Lekki renamed');
  });

  it('asks which channel to edit when the store has several and none is named', async () => {
    const { service } = build([
      channel(),
      channel({ id: 'chan-2', merchantReference: 'MERCH-2' }),
    ]);

    await expect(
      service.upsertConfig('biz-1', 'store-1', { label: 'x' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps the stored secret when the form submits without one', async () => {
    const { service, integrationRepo } = build([channel()]);

    await service.upsertConfig(
      'biz-1',
      'store-1',
      { label: 'Renamed' } as never,
      'chan-1',
    );

    expect(integrationRepo.rows[0].secretKey).toBe('sk_1');
  });

  it('requires a secret key the first time a channel is connected', async () => {
    const { service } = build([]);

    await expect(
      service.upsertConfig('biz-1', 'store-1', {
        merchantReference: 'MERCH-1',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('names the clash when a duplicate merchant reference is added', async () => {
    const { service, integrationRepo } = build([channel()]);
    integrationRepo.save.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505' }) as never,
    );

    await expect(
      service.upsertConfig('biz-1', 'store-1', {
        merchantReference: 'MERCH-1',
        secretKey: 'sk_2',
        createNew: true,
      } as never),
    ).rejects.toThrow(/already connected to Chowdeck merchant/);
  });

  it('gives each new channel its own webhook token', async () => {
    const { service, integrationRepo } = build([channel()]);

    await service.upsertConfig('biz-1', 'store-1', {
      merchantReference: 'MERCH-2',
      secretKey: 'sk_2',
      createNew: true,
    } as never);

    const tokens = integrationRepo.rows.map((r) => r.webhookToken);
    expect(new Set(tokens).size).toBe(2);
    expect(tokens.every(Boolean)).toBe(true);
  });
});
