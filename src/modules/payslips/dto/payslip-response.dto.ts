import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  PayslipEntity,
  PayslipStatus,
  PaymentMethod,
} from '../entities/payslip.entity';
import {
  AdjustmentType,
  PayslipAdjustmentEntity,
} from '../entities/payslip-adjustment.entity';

export class PayslipAdjustmentLineDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Housing Allowance' })
  @Expose()
  name: string;

  @ApiProperty({ example: 10000 })
  @Expose()
  amount: number;

  @ApiProperty({ enum: AdjustmentType })
  @Expose()
  type: AdjustmentType;
}

export class PayslipResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  staffId: string;

  @ApiProperty({ example: 'Amaka Okafor', description: 'Denormalised staff full name' })
  @Expose()
  staffName: string;

  @ApiProperty({ example: 'April 2026' })
  @Expose()
  period: string;

  @ApiProperty({ example: '2026-04-01' })
  @Expose()
  periodStart: string;

  @ApiProperty({ example: '2026-04-30' })
  @Expose()
  periodEnd: string;

  @ApiProperty({ example: 150000 })
  @Expose()
  baseSalary: number;

  @ApiPropertyOptional({ nullable: true, example: 176 })
  @Expose()
  hoursWorked: number | null;

  @ApiPropertyOptional({ nullable: true, example: 8 })
  @Expose()
  overtimeHours: number | null;

  @ApiPropertyOptional({ nullable: true, example: 1250 })
  @Expose()
  overtimeRate: number | null;

  @ApiProperty({ type: () => [PayslipAdjustmentLineDto] })
  @Expose()
  @Type(() => PayslipAdjustmentLineDto)
  additions: PayslipAdjustmentLineDto[];

  @ApiProperty({ type: () => [PayslipAdjustmentLineDto] })
  @Expose()
  @Type(() => PayslipAdjustmentLineDto)
  deductions: PayslipAdjustmentLineDto[];

  @ApiProperty({ example: 160000 })
  @Expose()
  grossPay: number;

  @ApiProperty({ example: 148000 })
  @Expose()
  netPay: number;

  @ApiProperty({ enum: PayslipStatus, example: PayslipStatus.DRAFT })
  @Expose()
  status: PayslipStatus;

  @ApiPropertyOptional({ nullable: true, example: '2026-05-01' })
  @Expose()
  paymentDate: string | null;

  @ApiPropertyOptional({ enum: PaymentMethod, nullable: true })
  @Expose()
  paymentMethod: PaymentMethod | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  receiptUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: PayslipEntity): PayslipResponseDto {
    const adjustments = (entity.adjustments ?? []) as PayslipAdjustmentEntity[];
    const mapAdjustment = (a: PayslipAdjustmentEntity) => ({
      id: a.id,
      name: a.name,
      amount: Number(a.amount),
      type: a.type,
    });
    return plainToInstance(
      PayslipResponseDto,
      {
        ...entity,
        staffName: entity.staff
          ? `${entity.staff.firstName} ${entity.staff.lastName}`
          : '',
        baseSalary: Number(entity.baseSalary),
        hoursWorked: entity.hoursWorked == null ? null : Number(entity.hoursWorked),
        overtimeHours: entity.overtimeHours == null ? null : Number(entity.overtimeHours),
        overtimeRate: entity.overtimeRate == null ? null : Number(entity.overtimeRate),
        grossPay: Number(entity.grossPay),
        netPay: Number(entity.netPay),
        paymentDate: entity.paymentDate ?? null,
        paymentMethod: entity.paymentMethod ?? null,
        receiptUrl: entity.receiptUrl ?? null,
        notes: entity.notes ?? null,
        additions: adjustments.filter((a) => !a.isDeduction).map(mapAdjustment),
        deductions: adjustments.filter((a) => a.isDeduction).map(mapAdjustment),
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: PayslipEntity[]): PayslipResponseDto[] {
    return entities.map((e) => PayslipResponseDto.from(e));
  }
}
