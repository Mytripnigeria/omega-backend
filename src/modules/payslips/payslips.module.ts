import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayslipEntity } from './entities/payslip.entity';
import { PayslipAdjustmentEntity } from './entities/payslip-adjustment.entity';
import { PayslipsService } from './payslips.service';
import { PayslipsController } from './payslips.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PayslipEntity, PayslipAdjustmentEntity])],
  controllers: [PayslipsController],
  providers: [PayslipsService],
  exports: [PayslipsService],
})
export class PayslipsModule {}
