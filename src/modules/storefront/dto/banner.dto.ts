import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  BannerTheme,
  StorefrontBannerEntity,
} from '../entities/storefront-banner.entity';

export class CreateStorefrontBannerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ enum: BannerTheme, default: BannerTheme.DARK })
  @IsOptional()
  @IsEnum(BannerTheme)
  theme?: BannerTheme;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateStorefrontBannerDto extends PartialType(CreateStorefrontBannerDto) {}

export class StorefrontBannerFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class StorefrontBannerResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty()
  @Expose()
  imageUrl: string;

  @ApiProperty({ enum: BannerTheme })
  @Expose()
  theme: BannerTheme;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  actionText: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  actionUrl: string | null;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  position: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  startsAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  endsAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StorefrontBannerEntity): StorefrontBannerResponseDto {
    return plainToInstance(StorefrontBannerResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
