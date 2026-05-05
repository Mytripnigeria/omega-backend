import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../entities/payslip.entity';

export class MarkPaidDto {
  @ApiProperty({ example: '2024-01-31', description: 'Date payment was disbursed (ISO 8601)' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BANK, description: 'Payment method used to disburse salary' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'https://cdn.mrjollof.com/payslips/receipt-jan24.pdf', description: 'URL to payment receipt or proof of transfer' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
