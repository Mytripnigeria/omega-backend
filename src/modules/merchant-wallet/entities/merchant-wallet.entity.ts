import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Per-business cash balance representing money the platform owes the
 * merchant (i.e., online order proceeds that haven't been paid out yet).
 * Single row per business — lazily created on first read/credit.
 */
@Entity('merchant_wallets')
@Unique(['businessId'])
export class MerchantWalletEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  businessId: string;

  @ApiProperty({
    example: 145600,
    description: 'Currently available balance, in business currency.',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @ApiProperty({
    example: 50000,
    description:
      'Funds reserved for in-flight payouts (state pending/queued/processing). ' +
      'Available balance = balance - reservedBalance.',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  reservedBalance: number;

  @ApiProperty({ default: 'NGN' })
  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
