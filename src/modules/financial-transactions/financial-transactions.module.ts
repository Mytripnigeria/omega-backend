import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialTransactionEntity } from './entities/financial-transaction.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinancialTransactionsController } from './financial-transactions.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FinancialTransactionEntity, OrderEntity])],
  controllers: [FinancialTransactionsController],
  providers: [FinancialTransactionsService],
  exports: [FinancialTransactionsService],
})
export class FinancialTransactionsModule {}
