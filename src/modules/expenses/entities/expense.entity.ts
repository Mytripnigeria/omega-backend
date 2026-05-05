import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

export enum ExpenseCategory {
  SUPPLIES = 'supplies',
  UTILITIES = 'utilities',
  MAINTENANCE = 'maintenance',
  TRANSPORT = 'transport',
  SALARIES = 'salaries',
  OTHER = 'other',
}

@Entity('expenses')
export class ExpenseEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid', description: 'Staff member who submitted the expense' })
  @Column({ type: 'uuid' })
  @Index()
  requestedById: string;

  @ApiProperty({ example: 'Amaka Okafor' })
  @Column({ type: 'varchar' })
  requestedByName: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.SUPPLIES })
  @Column({ type: 'enum', enum: ExpenseCategory })
  category: ExpenseCategory;

  @ApiProperty({ example: 12500.0 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({ example: 'NGN', description: 'ISO 4217 currency code' })
  @Column({ type: 'varchar', length: 8, default: 'NGN' })
  currency: string;

  @ApiProperty({ example: 'Replacement gas cylinder for kitchen' })
  @Column({ type: 'text' })
  description: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'FileEntity ID for the receipt' })
  @Column({ type: 'uuid', nullable: true })
  receiptFileId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string | null;

  @ApiProperty({ enum: ExpenseStatus, example: ExpenseStatus.PENDING })
  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  @Index()
  status: ExpenseStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  reviewedByName: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
