import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPaymentMethodEntity } from './entities/customer-payment-method.entity';
import { CustomerPaymentMethodsService } from './customer-payment-methods.service';
import { CustomerPaymentMethodsController } from './customer-payment-methods.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerPaymentMethodEntity])],
  controllers: [CustomerPaymentMethodsController],
  providers: [CustomerPaymentMethodsService],
  exports: [CustomerPaymentMethodsService, TypeOrmModule],
})
export class CustomerPaymentMethodsModule {}
