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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ format: 'uuid', example: 'f1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  staffId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;

  @ApiProperty({ example: 'April 2026', description: 'Human-readable pay period label' })
  @Column()
  period: string;

  @ApiProperty({ example: '2026-04-01', description: 'ISO date string (YYYY-MM-DD)' })
  @Column({ type: 'date' })
  periodStart: string;

  @ApiProperty({ example: '2026-04-30', description: 'ISO date string (YYYY-MM-DD)' })
  @Column({ type: 'date' })
  periodEnd: string;

  @ApiProperty({ example: 150000.00 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  baseSalary: number;

  @ApiPropertyOptional({ example: 176.0, nullable: true, description: 'Total regular hours worked' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hoursWorked: number;

  @ApiPropertyOptional({ example: 8.0, nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  overtimeHours: number;

  @ApiPropertyOptional({ example: 1250.00, nullable: true, description: 'Rate per overtime hour' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  overtimeRate: number;

  @ApiProperty({ example: 160000.00, description: 'Total pay before deductions' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossPay: number;

  @ApiProperty({ example: 148000.00, description: 'Total pay after all adjustments' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netPay: number;

  @ApiProperty({
    enum: PayslipStatus,
    example: PayslipStatus.DRAFT,
    description: 'Status lifecycle: draft → pending → approved → paid',
  })
  @Column({ type: 'enum', enum: PayslipStatus, default: PayslipStatus.DRAFT })
  status: PayslipStatus;

  @ApiPropertyOptional({ example: '2026-05-01', nullable: true, description: 'Date payment was disbursed' })
  @Column({ type: 'date', nullable: true })
  paymentDate: string;

  @ApiPropertyOptional({ enum: PaymentMethod, nullable: true, example: PaymentMethod.BANK })
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/receipts/apr-2026.pdf', nullable: true })
  @Column({ nullable: true })
  receiptUrl: string;

  @ApiPropertyOptional({ example: 'Includes Easter bonus', nullable: true })
  @Column({ nullable: true })
  notes: string;

  @ApiProperty({ type: () => [PayslipAdjustmentEntity] })
  @OneToMany(() => PayslipAdjustmentEntity, (adj) => adj.payslip, {
    cascade: true,
    eager: true,
  })
  adjustments: PayslipAdjustmentEntity[];

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
