import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ReferralRewardType } from './referral.entity';

@Entity('referral_settings')
@Unique(['businessId'])
export class ReferralSettingsEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  businessId: string;

  @ApiProperty({
    example: 1000,
    description: 'Reward to the referrer once their friend places a paid order',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 1000 })
  referrerReward: number;

  @ApiProperty({
    example: 500,
    description: 'Reward credited to a new customer who signs up with a code',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 500 })
  referredReward: number;

  @ApiProperty({ enum: ['wallet_credit', 'points'], default: 'wallet_credit' })
  @Column({
    type: 'enum',
    enum: ['wallet_credit', 'points'],
    default: 'wallet_credit',
  })
  rewardType: ReferralRewardType;

  @ApiProperty({
    example: 30,
    description: 'Days until a pending referral expires (0 = never)',
  })
  @Column({ type: 'int', default: 30 })
  expiryDays: number;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
