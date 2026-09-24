import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CouponEntity,
  CouponRedemptionEntity,
} from './entities/coupon.entity';
import { CouponsService } from './coupons.service';
import { AutomaticDiscountsService } from './automatic-discounts.service';
import {
  CouponsController,
  PublicCouponsController,
  StorefrontCouponsController,
} from './coupons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, CouponRedemptionEntity])],
  controllers: [
    CouponsController,
    StorefrontCouponsController,
    PublicCouponsController,
  ],
  providers: [CouponsService, AutomaticDiscountsService],
  exports: [CouponsService, AutomaticDiscountsService],
})
export class CouponsModule {}
