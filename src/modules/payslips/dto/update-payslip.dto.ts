import { PartialType, OmitType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CreatePayslipDto } from './create-payslip.dto';
import { PaymentMethod } from '../entities/payslip.entity';

export class UpdatePayslipDto extends PartialType(
  OmitType(CreatePayslipDto, ['storeId', 'staffId'] as const),
) {
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  receiptUrl?: string;
}
