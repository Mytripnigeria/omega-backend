import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type MerchantWalletTxType = 'credit' | 'debit';

export type MerchantWalletTxReason =
  | 'order_payment'
  | 'order_refund'
  | 'payout_reserved'
  | 'payout_released'
  | 'payout_settled'
  | 'adjustment';

/**
 * Append-only ledger of every change to the merchant wallet balance.
 * Each row carries the post-change `balance` for fast reconstruction.
 */
@Entity('merchant_wallet_transactions')
@Index(['businessId', 'createdAt'])
export class MerchantWalletTransactionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  walletId: string;

  @ApiProperty({ enum: ['credit', 'debit'] })
  @Column({ type: 'enum', enum: ['credit', 'debit'] })
  type: MerchantWalletTxType;

  @ApiProperty({
    enum: [
      'order_payment',
      'order_refund',
      'payout_reserved',
      'payout_released',
      'payout_settled',
      'adjustment',
    ],
  })
  @Column({
    type: 'enum',
    enum: [
      'order_payment',
      'order_refund',
      'payout_reserved',
      'payout_released',
      'payout_settled',
      'adjustment',
    ],
  })
  reason: MerchantWalletTxReason;

  @ApiProperty({ example: 12500 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({
    example: 145600,
    description: 'Wallet balance after this transaction was applied.',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balanceAfter: number;

  @ApiProperty()
  @Column({ type: 'varchar' })
  description: string;

  @ApiPropertyOptional({ enum: ['order', 'payout'], nullable: true })
  @Column({ type: 'varchar', nullable: true })
  linkedType: 'order' | 'payout' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  linkedId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  storeId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
