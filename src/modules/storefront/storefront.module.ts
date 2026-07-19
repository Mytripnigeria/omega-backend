import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorefrontConfigEntity } from './entities/storefront-config.entity';
import { StorefrontPageEntity } from './entities/storefront-page.entity';
import { StorefrontBannerEntity } from './entities/storefront-banner.entity';
import { StorefrontThemePresetEntity } from './entities/storefront-theme-preset.entity';
import { StorefrontPageViewEntity } from './entities/storefront-page-view.entity';
import { PaymentMethodEntity } from '../payment-methods/entities/payment-method.entity';
import { DomainEntity } from '../domains/entities/domain.entity';
import { StorefrontService } from './storefront.service';
import { StorefrontController } from './storefront.controller';
import { PublicStorefrontController } from './public-storefront.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { BusinessModule } from '../business/business.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorefrontConfigEntity,
      StorefrontPageEntity,
      StorefrontBannerEntity,
      StorefrontThemePresetEntity,
      StorefrontPageViewEntity,
      PaymentMethodEntity,
      DomainEntity,
    ]),
    ActivityLogModule,
    BusinessModule,
    LoyaltyModule,
  ],
  controllers: [StorefrontController, PublicStorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
