import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

@Entity('customer_wallet_transactions')
export class WalletTransactionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  customerId: string;

  @ApiProperty({ enum: WalletTransactionType })
  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @ApiProperty({ example: 5000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({ example: 12500, description: 'Wallet balance after this transaction' })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balance: number;

  @ApiProperty({ example: 'Loyalty top-up' })
  @Column({ type: 'text' })
  description: string;

  @ApiPropertyOptional({ example: 'order:abc-123', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

export enum PointsTransactionType {
  EARNED = 'earned',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
}

@Entity('customer_points_transactions')
export class PointsTransactionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  customerId: string;

  @ApiProperty({ enum: PointsTransactionType })
  @Column({ type: 'enum', enum: PointsTransactionType })
  type: PointsTransactionType;

  @ApiProperty({ example: 500, description: 'Signed point delta (positive for earned, negative for redeemed)' })
  @Column({ type: 'int' })
  points: number;

  @ApiProperty({ example: 1500, description: 'Points balance after this transaction' })
  @Column({ type: 'int' })
  balance: number;

  @ApiProperty({ example: 'Earned on order #1234' })
  @Column({ type: 'text' })
  description: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
