import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StoreEntity } from '../../store/entities/store.entity';
import { StaffEntity } from '../../staff/entities/staff.entity';
import { PayslipAdjustmentEntity } from './payslip-adjustment.entity';

export enum PayslipStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  BANK = 'bank',
  CASH = 'cash',
  CHECK = 'check',
}

@Entity('payslips')
export class PayslipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @Column()
  staffId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;

  @Column()
  period: string;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  baseSalary: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hoursWorked: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  overtimeHours: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  overtimeRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossPay: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netPay: number;

  @Column({ type: 'enum', enum: PayslipStatus, default: PayslipStatus.DRAFT })
  status: PayslipStatus;

  @Column({ type: 'date', nullable: true })
  paymentDate: string;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  receiptUrl: string;

  @Column({ nullable: true })
  notes: string;

  @OneToMany(() => PayslipAdjustmentEntity, (adj) => adj.payslip, {
    cascade: true,
    eager: true,
  })
  adjustments: PayslipAdjustmentEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
