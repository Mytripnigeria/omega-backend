import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CouponEntity, CouponType } from '../entities/coupon.entity';

export class CreateCouponDto {
  @ApiProperty({ example: 'SAVE10' })
  @IsString()
  @MinLength(2)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Coupon code must be uppercase letters, digits, underscore, or dash',
  })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class CouponFilterDto extends PaginationQueryDto {
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

export class ValidateCouponDto {
  @ApiProperty({ example: 'SAVE10' })
  @IsString()
  code: string;

  @ApiProperty({ example: 4500 })
  @IsNumber()
  @Min(0)
  subtotal: number;
}

export class CouponResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  code: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty({ enum: CouponType })
  @Expose()
  type: CouponType;

  @ApiProperty()
  @Expose()
  value: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  minOrderAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  maxDiscount: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  usageLimit: number | null;

  @ApiProperty()
  @Expose()
  usageCount: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  perCustomerLimit: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  startsAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  endsAt: Date | null;

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

  static from(entity: CouponEntity): CouponResponseDto {
    return plainToInstance(
      CouponResponseDto,
      {
        ...entity,
        value: Number(entity.value),
        minOrderAmount:
          entity.minOrderAmount == null ? null : Number(entity.minOrderAmount),
        maxDiscount:
          entity.maxDiscount == null ? null : Number(entity.maxDiscount),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class ValidateCouponResponseDto {
  @ApiProperty()
  valid: boolean;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional({ type: () => CouponResponseDto })
  coupon?: CouponResponseDto;

  @ApiPropertyOptional({ example: 1000 })
  discountAmount?: number;
}
