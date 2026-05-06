import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralEntity } from './entities/referral.entity';
import { ReferralSettingsEntity } from './entities/referral-settings.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  WalletTransactionEntity,
} from '../customers/entities/wallet-transaction.entity';
import { ReferralsService } from './referrals.service';
import {
  ReferralsController,
  StorefrontReferralsController,
} from './referrals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferralEntity,
      ReferralSettingsEntity,
      CustomerEntity,
      WalletTransactionEntity,
      PointsTransactionEntity,
    ]),
  ],
  controllers: [ReferralsController, StorefrontReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
