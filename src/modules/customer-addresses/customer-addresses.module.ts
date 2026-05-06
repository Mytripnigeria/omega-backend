import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAddressEntity } from './entities/customer-address.entity';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerAddressesController } from './customer-addresses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerAddressEntity])],
  controllers: [CustomerAddressesController],
  providers: [CustomerAddressesService],
  exports: [CustomerAddressesService, TypeOrmModule],
})
export class CustomerAddressesModule {}
