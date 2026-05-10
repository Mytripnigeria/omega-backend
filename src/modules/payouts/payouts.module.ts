import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PayoutEntity } from './entities/payout.entity';
import { PayoutBankAccountEntity } from './entities/payout-bank-account.entity';
import { PayoutsService, PAYOUTS_QUEUE } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsProcessor } from './payouts.processor';
import { PaystackModule } from '../paystack/paystack.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutEntity, PayoutBankAccountEntity]),
    BullModule.registerQueue({ name: PAYOUTS_QUEUE }),
    PaystackModule,
    ActivityLogModule,
    // MerchantWalletModule is @Global so we don't need to import it.
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsProcessor],
  exports: [PayoutsService],
})
export class PayoutsModule {}
