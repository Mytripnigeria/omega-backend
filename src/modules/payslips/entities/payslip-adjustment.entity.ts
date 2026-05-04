import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  payslipId: string;

  @ManyToOne(() => PayslipEntity, (p) => p.adjustments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payslipId' })
  payslip: PayslipEntity;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  @Column({ default: false })
  isDeduction: boolean;
}
