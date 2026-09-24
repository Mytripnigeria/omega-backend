import { AutomaticDiscountsService } from './automatic-discounts.service';
import { CouponEntity, CouponMethod, CouponType } from './entities/coupon.entity';

/**
 * Round-12 feedback, Storefront:
 *  - "Discount created with 'Method' set as Automatic should apply the price
 *     difference on the storefront listing price since that discount type
 *     automatically applies to the product (all, specific or under selected
 *     categories), currently it doesn't work that way."
 *
 * It didn't work at all: `method` was stored and nothing ever read it.
 */
const coupon = (over: Partial<CouponEntity> = {}): CouponEntity =>
  ({
    id: 'c-1',
    businessId: 'biz-1',
    code: 'LAUNCH',
    description: 'Launch week',
    type: CouponType.PERCENTAGE,
    method: CouponMethod.AUTOMATIC,
    value: 30,
    minOrderAmount: null,
    maxDiscount: null,
    usageLimit: null,
    usageCount: 0,
    perCustomerLimit: null,
    startsAt: null,
    endsAt: null,
    isActive: true,
    applicableTo: 'all',
    productIds: [],
    categoryIds: [],
    ...over,
  }) as CouponEntity;

const jollof = { id: 'p-jollof', categoryId: 'cat-rice' };

describe('AutomaticDiscountsService', () => {
  describe('what a discount takes off', () => {
    it('takes a percentage off the shelf price', () => {
      const d = AutomaticDiscountsService.bestFor([coupon()], jollof, 4500);

      expect(d).toMatchObject({ originalPrice: 4500, price: 3150, savings: 1350, percentOff: 30 });
    });

    it('takes a fixed amount off', () => {
      const d = AutomaticDiscountsService.bestFor(
        [coupon({ type: CouponType.FIXED, value: 500 })],
        jollof,
        4500,
      );

      expect(d).toMatchObject({ price: 4000, savings: 500 });
    });

    it('respects the merchant’s cap on a percentage', () => {
      const d = AutomaticDiscountsService.bestFor(
        [coupon({ value: 50, maxDiscount: 1000 })],
        jollof,
        4500,
      );

      expect(d).toMatchObject({ price: 3500, savings: 1000 });
    });

    it('never prices below zero', () => {
      const d = AutomaticDiscountsService.bestFor(
        [coupon({ type: CouponType.FIXED, value: 9000 })],
        jollof,
        4500,
      );

      expect(d?.price).toBe(0);
    });

    it('never overstates the percentage on the badge', () => {
      // ₦500 off ₦1,499 is 33.36%; the badge rounds down and says 33%.
      const odd = AutomaticDiscountsService.bestFor(
        [coupon({ type: CouponType.FIXED, value: 500 })],
        jollof,
        1499,
      );
      expect(odd?.percentOff).toBe(33);

      const exact = AutomaticDiscountsService.bestFor(
        [coupon({ type: CouponType.FIXED, value: 500 })],
        jollof,
        2000,
      );
      expect(exact?.percentOff).toBe(25);
    });

    it('drops the badge when the saving rounds to nothing', () => {
      const tiny = AutomaticDiscountsService.bestFor(
        [coupon({ type: CouponType.FIXED, value: 5 })],
        jollof,
        4500,
      );

      expect(tiny?.savings).toBe(5);
      expect(tiny?.percentOff).toBeNull();
    });
  });

  describe('which products it covers', () => {
    it('applies to everything when set to all', () => {
      expect(AutomaticDiscountsService.bestFor([coupon()], jollof, 1000)).not.toBeNull();
    });

    it('applies only to the named products', () => {
      const only = coupon({ applicableTo: 'specific_products', productIds: ['p-other'] });

      expect(AutomaticDiscountsService.bestFor([only], jollof, 1000)).toBeNull();
      expect(
        AutomaticDiscountsService.bestFor([only], { id: 'p-other', categoryId: null }, 1000),
      ).not.toBeNull();
    });

    it('applies only within the named categories', () => {
      const rice = coupon({ applicableTo: 'specific_categories', categoryIds: ['cat-rice'] });

      expect(AutomaticDiscountsService.bestFor([rice], jollof, 1000)).not.toBeNull();
      expect(
        AutomaticDiscountsService.bestFor([rice], { id: 'p-x', categoryId: 'cat-drinks' }, 1000),
      ).toBeNull();
    });

    it('leaves an uncategorised product out of a category promotion', () => {
      const rice = coupon({ applicableTo: 'specific_categories', categoryIds: ['cat-rice'] });

      expect(
        AutomaticDiscountsService.bestFor([rice], { id: 'p-x', categoryId: null }, 1000),
      ).toBeNull();
    });
  });

  describe('when two promotions overlap', () => {
    it('gives the customer the better one, and never both', () => {
      const ten = coupon({ id: 'c-10', value: 10 });
      const thirty = coupon({ id: 'c-30', value: 30 });

      const d = AutomaticDiscountsService.bestFor([ten, thirty], jollof, 1000);

      expect(d).toMatchObject({ couponId: 'c-30', price: 700 });
    });

    it('compares real money, not headline numbers', () => {
      // 50% capped at ₦200 is worth less than a flat ₦500 on a ₦2,000 dish.
      const cappedHalf = coupon({ id: 'c-half', value: 50, maxDiscount: 200 });
      const flat = coupon({ id: 'c-flat', type: CouponType.FIXED, value: 500 });

      const d = AutomaticDiscountsService.bestFor([cappedHalf, flat], jollof, 2000);

      expect(d?.couponId).toBe('c-flat');
    });
  });

  it('carries the merchant’s own wording for the badge', () => {
    const d = AutomaticDiscountsService.bestFor([coupon({ description: 'Launch week' })], jollof, 1000);

    expect(d?.label).toBe('Launch week');
  });
});

describe('AutomaticDiscountsService.activeFor', () => {
  const build = (rows: CouponEntity[]) => {
    const repo = { find: jest.fn(async () => rows) };
    return new AutomaticDiscountsService(repo as never);
  };
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-09-24T12:00:00Z');

  it('ignores a promotion that has not started', async () => {
    const service = build([coupon({ startsAt: new Date(now.getTime() + day) })]);

    expect(await service.activeFor('biz-1', now)).toHaveLength(0);
  });

  it('ignores one that has finished', async () => {
    const service = build([coupon({ endsAt: new Date(now.getTime() - day) })]);

    expect(await service.activeFor('biz-1', now)).toHaveLength(0);
  });

  it('keeps one inside its window', async () => {
    const service = build([
      coupon({
        startsAt: new Date(now.getTime() - day),
        endsAt: new Date(now.getTime() + day),
      }),
    ]);

    expect(await service.activeFor('biz-1', now)).toHaveLength(1);
  });

  it('asks only for this business’s live automatic discounts', async () => {
    const repo = { find: jest.fn(async () => []) };
    await new AutomaticDiscountsService(repo as never).activeFor('biz-1', now);

    expect(repo.find).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', method: CouponMethod.AUTOMATIC, isActive: true },
    });
  });
});
