import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { PayslipEntity } from './payslip.entity';

export enum AdjustmentType {
  BONUS = 'bonus',
  ALLOWANCE = 'allowance',
  COMMISSION = 'commission',
  TAX = 'tax',
  INSURANCE = 'insurance',
  LOAN = 'loan',
  OTHER = 'other',
}

@Entity('payslip_adjustments')
export class PayslipAdjustmentEntity {
  @ApiProperty({ format: 'uuid', example: 'e1f2a3b4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'f1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  payslipId: string;

  @ManyToOne(() => PayslipEntity, (p) => p.adjustments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payslipId' })
  payslip: PayslipEntity;

  @ApiProperty({ example: 'Housing Allowance' })
  @Column()
  name: string;

  @ApiProperty({ example: 10000.00 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({ enum: AdjustmentType, example: AdjustmentType.ALLOWANCE })
  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  @ApiProperty({ example: false, description: '`true` means this adjustment reduces net pay (e.g. tax, loan)' })
  @Column({ default: false })
  isDeduction: boolean;
}
