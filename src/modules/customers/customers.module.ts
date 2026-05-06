import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity } from './entities/customer.entity';
import {
  PointsTransactionEntity,
  WalletTransactionEntity,
} from './entities/wallet-transaction.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { StorefrontCustomerController } from './storefront-customer.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      WalletTransactionEntity,
      PointsTransactionEntity,
      UserEntity,
    ]),
    ActivityLogModule,
  ],
  controllers: [CustomersController, StorefrontCustomerController],
  providers: [CustomersService],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
