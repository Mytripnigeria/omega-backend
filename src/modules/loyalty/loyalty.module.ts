import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyTierEntity } from './entities/loyalty-tier.entity';
import { LoyaltySettingsEntity } from './entities/loyalty-settings.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { PointsTransactionEntity } from '../customers/entities/wallet-transaction.entity';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoyaltyTierEntity,
      LoyaltySettingsEntity,
      CustomerEntity,
      PointsTransactionEntity,
    ]),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
