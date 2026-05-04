import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxRateEntity } from './entities/tax-rate.entity';
import { TaxRatesService } from './tax-rates.service';
import { TaxRatesController } from './tax-rates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaxRateEntity])],
  controllers: [TaxRatesController],
  providers: [TaxRatesService],
  exports: [TaxRatesService],
})
export class TaxRatesModule {}
