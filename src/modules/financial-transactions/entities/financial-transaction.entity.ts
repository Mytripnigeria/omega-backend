import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type TransactionType = 'credit' | 'debit';

export type TransactionPurpose =
  | 'order_payment'
  | 'order_refund'
  | 'wallet_credit'
  | 'wallet_debit'
  | 'expense_payment'
  | 'payout'
  | 'manual_adjustment';

export type TransactionMethod =
  | 'cash'
  | 'card'
  | 'wallet'
  | 'points'
  | 'paystack'
  | 'transfer'
  | 'other';

export type TransactionLinkedType = 'order' | 'wallet_tx' | 'expense' | null;

@Entity('financial_transactions')
@Index(['businessId', 'createdAt'])
@Index(['linkedType', 'linkedId'])
export class FinancialTransactionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  storeId: string | null;

  @ApiProperty({ enum: ['credit', 'debit'] })
  @Column({ type: 'enum', enum: ['credit', 'debit'] })
  type: TransactionType;

  @ApiProperty({
    enum: [
      'order_payment',
      'order_refund',
      'wallet_credit',
      'wallet_debit',
      'expense_payment',
      'payout',
      'manual_adjustment',
    ],
  })
  @Column({
    type: 'enum',
    enum: [
      'order_payment',
      'order_refund',
      'wallet_credit',
      'wallet_debit',
      'expense_payment',
      'payout',
      'manual_adjustment',
    ],
  })
  @Index()
  purpose: TransactionPurpose;

  @ApiProperty({ example: 5000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiPropertyOptional({
    enum: ['cash', 'card', 'wallet', 'points', 'paystack', 'transfer', 'other'],
    nullable: true,
  })
  @Column({
    type: 'enum',
    enum: ['cash', 'card', 'wallet', 'points', 'paystack', 'transfer', 'other'],
    nullable: true,
  })
  method: TransactionMethod | null;

  @ApiProperty({ default: 'NGN' })
  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @ApiPropertyOptional({ nullable: true, description: 'Free-text reference (e.g. Paystack ref)' })
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @ApiProperty({ example: 'Order #42 paid via cash' })
  @Column({ type: 'varchar' })
  description: string;

  @ApiPropertyOptional({ enum: ['order', 'wallet_tx', 'expense'], nullable: true })
  @Column({ type: 'varchar', nullable: true })
  linkedType: 'order' | 'wallet_tx' | 'expense' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  linkedId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  staffName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
