import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdjustmentType } from '../entities/payslip-adjustment.entity';

export class PayslipAdjustmentDto {
  @ApiProperty({ example: 'Transport Allowance', description: 'Label for this adjustment line' })
  @IsString()
  name: string;

  @ApiProperty({ example: 10000, description: 'Adjustment amount in kobo (NGN)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: AdjustmentType, example: AdjustmentType.ALLOWANCE })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({ example: false, description: 'true = subtracted from net pay; false = added to net pay' })
  @IsBoolean()
  isDeduction: boolean;
}

export class CreatePayslipDto {
  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store the payslip belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ format: 'uuid', example: 'sf1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Staff member being paid' })
  @IsUUID()
  staffId: string;

  @ApiProperty({ example: '2024-01', description: 'Pay period label in YYYY-MM format' })
  @IsString()
  period: string;

  @ApiProperty({ example: '2024-01-01', description: 'First day of the pay period (ISO 8601)' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2024-01-31', description: 'Last day of the pay period (ISO 8601)' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ example: 150000, description: 'Base salary for this period in kobo (NGN)' })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiPropertyOptional({ example: 160, description: 'Total regular hours worked in this period' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hoursWorked?: number;

  @ApiPropertyOptional({ example: 8, description: 'Overtime hours worked in this period' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @ApiPropertyOptional({ example: 1250, description: 'Pay rate per overtime hour in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeRate?: number;

  @ApiPropertyOptional({
    type: () => [PayslipAdjustmentDto],
    description: 'Additional allowances or deductions',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayslipAdjustmentDto)
  adjustments?: PayslipAdjustmentDto[];

  @ApiPropertyOptional({ example: 'January salary. Includes Christmas bonus.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
