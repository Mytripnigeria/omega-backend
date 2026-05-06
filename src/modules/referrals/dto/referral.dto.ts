import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ReferralEntity,
  ReferralRewardType,
  ReferralStatus,
} from '../entities/referral.entity';
import { ReferralSettingsEntity } from '../entities/referral-settings.entity';

export class ReferralFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'signed_up', 'first_purchase', 'rewarded', 'expired'],
  })
  @IsOptional()
  @IsEnum(['pending', 'signed_up', 'first_purchase', 'rewarded', 'expired'])
  status?: ReferralStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  referrerCustomerId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ReferralResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  referrerCustomerId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  referredCustomerId: string;

  @ApiProperty()
  @Expose()
  referralCode: string;

  @ApiProperty({
    enum: ['pending', 'signed_up', 'first_purchase', 'rewarded', 'expired'],
  })
  @Expose()
  status: ReferralStatus;

  @ApiProperty()
  @Expose()
  referrerReward: number;

  @ApiProperty()
  @Expose()
  referredReward: number;

  @ApiProperty({ enum: ['wallet_credit', 'points'] })
  @Expose()
  rewardType: ReferralRewardType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  firstOrderId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  signedUpAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  firstPurchaseAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  rewardedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  expiresAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  referrerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  referredName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  referredEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  referredPhone: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: ReferralEntity,
    extras: {
      referrerName?: string | null;
      referredName?: string | null;
      referredEmail?: string | null;
      referredPhone?: string | null;
    } = {},
  ): ReferralResponseDto {
    return plainToInstance(
      ReferralResponseDto,
      {
        ...entity,
        referrerReward: Number(entity.referrerReward),
        referredReward: Number(entity.referredReward),
        ...extras,
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class UpdateReferralSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  referrerReward?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  referredReward?: number;

  @ApiPropertyOptional({ enum: ['wallet_credit', 'points'] })
  @IsOptional()
  @IsEnum(['wallet_credit', 'points'])
  rewardType?: ReferralRewardType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  expiryDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReferralSettingsResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  referrerReward: number;

  @ApiProperty()
  @Expose()
  referredReward: number;

  @ApiProperty({ enum: ['wallet_credit', 'points'] })
  @Expose()
  rewardType: ReferralRewardType;

  @ApiProperty()
  @Expose()
  expiryDays: number;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ReferralSettingsEntity): ReferralSettingsResponseDto {
    return plainToInstance(
      ReferralSettingsResponseDto,
      {
        ...entity,
        referrerReward: Number(entity.referrerReward),
        referredReward: Number(entity.referredReward),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class ReferralStatsDto {
  @ApiProperty()
  totalReferrals: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  signedUp: number;

  @ApiProperty()
  rewarded: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  totalRewardsPaid: number;

  @ApiProperty()
  totalPendingRewards: number;
}

export class MyReferralsSummaryDto {
  @ApiProperty()
  referralCode: string;

  @ApiProperty()
  totalReferred: number;

  @ApiProperty()
  rewardedCount: number;

  @ApiProperty()
  pendingCount: number;

  @ApiProperty()
  totalRewardEarned: number;

  @ApiProperty()
  totalRewardPending: number;

  @ApiProperty({ enum: ['wallet_credit', 'points'] })
  rewardType: ReferralRewardType;

  @ApiProperty({ type: [ReferralResponseDto] })
  referrals: ReferralResponseDto[];
}
