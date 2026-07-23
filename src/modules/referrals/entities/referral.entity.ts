import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ReferralStatus =
  | 'pending'
  | 'signed_up'
  | 'first_purchase'
  | 'rewarded'
  | 'expired';

export type ReferralRewardType = 'wallet_credit' | 'points';

@Entity('referrals')
@Unique(['businessId', 'referredCustomerId'])
@Index(['businessId', 'referrerCustomerId'])
@Index(['businessId', 'status'])
export class ReferralEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  referrerCustomerId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  referredCustomerId: string;

  @ApiProperty({ description: 'Referral code used at signup' })
  @Column({ type: 'varchar' })
  referralCode: string;

  @ApiProperty({
    enum: ['pending', 'signed_up', 'first_purchase', 'rewarded', 'expired'],
    default: 'signed_up',
  })
  @Column({
    type: 'enum',
    enum: ['pending', 'signed_up', 'first_purchase', 'rewarded', 'expired'],
    default: 'signed_up',
  })
  status: ReferralStatus;

  @ApiProperty({ description: 'Reward issued to the referrer (₦ or pts)' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  referrerReward: number;

  @ApiProperty({ description: 'Reward issued to the new (referred) customer' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  referredReward: number;

  @ApiProperty({ enum: ['wallet_credit', 'points'], default: 'wallet_credit' })
  @Column({
    type: 'enum',
    enum: ['wallet_credit', 'points'],
    default: 'wallet_credit',
  })
  rewardType: ReferralRewardType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  firstOrderId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  signedUpAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  firstPurchaseAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  rewardedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
