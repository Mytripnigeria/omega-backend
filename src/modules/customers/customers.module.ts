import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity } from './entities/customer.entity';
import {
  PointsTransactionEntity,
  WalletTransactionEntity,
} from './entities/wallet-transaction.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoyaltyTierEntity } from '../loyalty/entities/loyalty-tier.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { StorefrontCustomerController } from './storefront-customer.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { WalletDepositService } from './wallet-deposit.service';
import { PaystackModule } from '../paystack/paystack.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      WalletTransactionEntity,
      PointsTransactionEntity,
      UserEntity,
      LoyaltyTierEntity,
    ]),
    ActivityLogModule,
    PaystackModule,
    IntegrationsModule,
  ],
  controllers: [CustomersController, StorefrontCustomerController],
  providers: [CustomersService, WalletDepositService],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
