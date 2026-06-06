import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  LoyaltyBenefit,
  LoyaltyBenefitType,
  LoyaltyTierEntity,
} from '../entities/loyalty-tier.entity';
import { LoyaltySettingsEntity } from '../entities/loyalty-settings.entity';

export class LoyaltyBenefitDto implements LoyaltyBenefit {
  // `id` is omitted by the client when creating a new benefit; the service
  // fills it with a generated UUID before persisting. Always present on
  // responses, which is why @Expose() is needed for response serialization.
  @ApiPropertyOptional()
  @Expose()
  @IsOptional()
  @IsString()
  id: string;

  @ApiProperty({
    enum: [
      'discount',
      'free_shipping',
      'free_item',
      'points_multiplier',
      'exclusive_access',
    ],
  })
  @Expose()
  @IsEnum([
    'discount',
    'free_shipping',
    'free_item',
    'points_multiplier',
    'exclusive_access',
  ])
  type: LoyaltyBenefitType;

  @ApiProperty()
  @Expose()
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ default: '' })
  @Expose()
  @IsOptional()
  @IsString()
  description: string;
}

export class CreateLoyaltyTierDto {
  @ApiProperty({ example: 'Silver' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  minPoints: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ type: [LoyaltyBenefitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoyaltyBenefitDto)
  benefits?: LoyaltyBenefitDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLoyaltyTierDto extends PartialType(CreateLoyaltyTierDto) {}

export class LoyaltyTierFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class LoyaltyTierResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty()
  @Expose()
  minPoints: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  color: string | null;

  @ApiProperty({ type: [LoyaltyBenefitDto] })
  @Expose()
  @Type(() => LoyaltyBenefitDto)
  benefits: LoyaltyBenefit[];

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: 'Number of customers currently in this tier' })
  @Expose()
  memberCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: LoyaltyTierEntity,
    memberCount = 0,
  ): LoyaltyTierResponseDto {
    return plainToInstance(
      LoyaltyTierResponseDto,
      {
        ...entity,
        benefits: Array.isArray(entity.benefits) ? entity.benefits : [],
        memberCount,
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class UpdateLoyaltySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerNaira?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  nairaPerPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minPointsToRedeem?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsExpiryDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LoyaltySettingsResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  pointsPerNaira: number;

  @ApiProperty()
  @Expose()
  nairaPerPoint: number;

  @ApiProperty()
  @Expose()
  minPointsToRedeem: number;

  @ApiProperty()
  @Expose()
  pointsExpiryDays: number;

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

  static from(entity: LoyaltySettingsEntity): LoyaltySettingsResponseDto {
    return plainToInstance(
      LoyaltySettingsResponseDto,
      {
        ...entity,
        pointsPerNaira: Number(entity.pointsPerNaira),
        nairaPerPoint: Number(entity.nairaPerPoint),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class LoyaltyStatsDto {
  @ApiProperty()
  totalMembers: number;

  @ApiProperty()
  totalPointsIssued: number;

  @ApiProperty()
  totalPointsRedeemed: number;

  @ApiProperty()
  totalPointsBalance: number;

  @ApiProperty()
  rewardsRedeemed: number;
}
