import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, IsNull, Repository } from 'typeorm';
import {
  CouponEntity,
  CouponMethod,
  CouponType,
} from './entities/coupon.entity';

/** What an automatic discount does to one product's price. */
export interface AppliedDiscount {
  /** The price before the discount — struck through on the storefront. */
  originalPrice: number;
  /** What the customer actually pays. */
  price: number;
  /** originalPrice − price. */
  savings: number;
  /** Whole percent off, for the "-30%" badge. Null for an odd fraction. */
  percentOff: number | null;
  couponId: string;
  /** The merchant's own wording, e.g. "Launch week". */
  label: string | null;
}

/**
 * Discounts the merchant set to apply by themselves.
 *
 * A coupon with `method: automatic` has always been storable and has never
 * done anything: nothing read it when pricing the storefront, so a merchant
 * who set one up saw no change anywhere and the customer paid full price. The
 * hub promises "applied to product price instantly", and this is what makes
 * that true — in one place, so the price a shopper is shown and the price the
 * order is charged at cannot drift apart.
 *
 * Cart-level conditions do not belong here. `minOrderAmount`, usage caps and
 * per-customer caps all describe a basket or a person, and a shelf price
 * describes neither, so an automatic discount that carries them is applied on
 * its product rules alone.
 */
@Injectable()
export class AutomaticDiscountsService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepo: Repository<CouponEntity>,
  ) {}

  /** Every automatic discount currently live for a business. */
  async activeFor(businessId: string, now = new Date()): Promise<CouponEntity[]> {
    const rows = await this.couponRepo.find({
      where: { businessId, method: CouponMethod.AUTOMATIC, isActive: true },
    });
    return rows.filter(
      (c) =>
        (!c.startsAt || new Date(c.startsAt) <= now) &&
        (!c.endsAt || new Date(c.endsAt) >= now),
    );
  }

  /** Whether a discount covers this product. */
  static covers(
    coupon: CouponEntity,
    product: { id: string; categoryId?: string | null },
  ): boolean {
    switch (coupon.applicableTo) {
      case 'specific_products':
        return (coupon.productIds ?? []).includes(product.id);
      case 'specific_categories':
        return (
          !!product.categoryId &&
          (coupon.categoryIds ?? []).includes(product.categoryId)
        );
      default:
        return true;
    }
  }

  /** What one discount takes off a price. Never below zero. */
  static amountOff(coupon: CouponEntity, price: number): number {
    if (!(price > 0)) return 0;
    const raw =
      coupon.type === CouponType.PERCENTAGE
        ? (price * Number(coupon.value)) / 100
        : Number(coupon.value);
    const capped =
      coupon.maxDiscount != null ? Math.min(raw, Number(coupon.maxDiscount)) : raw;
    return Math.max(0, Math.min(Math.round(capped * 100) / 100, price));
  }

  /**
   * The best of the applicable discounts for a price — "best" being the one
   * that leaves the customer paying least, which is what a shopper would
   * expect when two promotions overlap. They are never stacked.
   */
  static bestFor(
    coupons: CouponEntity[],
    product: { id: string; categoryId?: string | null },
    price: number,
  ): AppliedDiscount | null {
    let best: { coupon: CouponEntity; off: number } | null = null;
    for (const coupon of coupons) {
      if (!AutomaticDiscountsService.covers(coupon, product)) continue;
      const off = AutomaticDiscountsService.amountOff(coupon, price);
      if (off <= 0) continue;
      if (!best || off > best.off) best = { coupon, off };
    }
    if (!best) return null;

    const newPrice = Math.round((price - best.off) * 100) / 100;
    // Rounded DOWN: a badge may understate what the customer saves, never
    // overstate it. ₦500 off ₦1,499 is 33.4%, and it says 33%.
    const percentOff = Math.floor((best.off / price) * 100);
    return {
      originalPrice: price,
      price: newPrice,
      savings: best.off,
      percentOff: percentOff > 0 ? percentOff : null,
      couponId: best.coupon.id,
      label: best.coupon.description ?? null,
    };
  }
}
