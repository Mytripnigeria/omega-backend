import { PublicMenuController } from './public-menu.controller';

/**
 * A store's storefront must offer a time whenever the API would accept an
 * order at that time. Order placement treats a store with NO opening hours as
 * unrestricted (`isStoreOpenAt` returns true); availability used to answer
 * "closed, no slots" for the same store, so the customer could never pick a
 * time and checkout refused an order the API would have taken — under a header
 * that still read "Open".
 */
const store = (openingHours: unknown) =>
  ({ id: 'store-1', businessId: 'biz-1', isActive: true, openingHours }) as never;

const makeController = (row: unknown) =>
  new PublicMenuController(
    {} as never,
    {} as never,
    {} as never,
    { findOne: jest.fn().mockResolvedValue(row) } as never,
    {} as never,
    {} as never,
    {} as never,
  );

const HOURS = {
  sunday: { open: '09:00', close: '21:00', closed: false },
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '21:00', closed: false },
  saturday: { open: '09:00', close: '21:00', closed: false },
};

describe('storefront availability', () => {
  const realNow = Date.now;
  beforeEach(() => {
    // A Thursday lunchtime — inside every fixture's opening hours.
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-24T12:00:00').getTime());
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T12:00:00'));
  });
  afterEach(() => {
    jest.useRealTimers();
    Date.now = realNow;
  });

  it('offers times for a store that has no opening hours configured', async () => {
    const controller = makeController(store(null));

    const res = await controller.availability('store-1', 'biz-1');

    expect(res.asapAvailable).toBe(true);
    expect(res.slots.length).toBeGreaterThan(0);
  });

  it('still closes a day the merchant marked closed', async () => {
    const controller = makeController(
      store({ ...HOURS, thursday: { open: '09:00', close: '21:00', closed: true } }),
    );

    const res = await controller.availability('store-1', 'biz-1');

    expect(res.asapAvailable).toBe(false);
    expect(res.slots).toEqual([]);
  });

  it('honours configured hours when the store is open', async () => {
    const controller = makeController(store(HOURS));

    const res = await controller.availability('store-1', 'biz-1');

    expect(res.asapAvailable).toBe(true);
    expect(res.slots.length).toBeGreaterThan(0);
  });

  it('says closed before opening time', async () => {
    jest.setSystemTime(new Date('2026-09-24T06:00:00'));
    const controller = makeController(store(HOURS));

    const res = await controller.availability('store-1', 'biz-1');

    expect(res.asapAvailable).toBe(false);
  });
});
