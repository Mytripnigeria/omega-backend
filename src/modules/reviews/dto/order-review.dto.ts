import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { OrderReviewEntity } from '../entities/order-review.entity';

export class CreateOrderReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /**
   * Photos attached to the review, as `data:image/...;base64,...` URLs — that
   * is what the storefront's picker produces, and it keeps customers off the
   * admin-only file-upload API. The server decodes and stores them.
   */
  @ApiPropertyOptional({
    type: [String],
    maxItems: 4,
    description: 'Up to 4 photos as base64 data URLs.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];
}

export class UpdateOrderReviewModerationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class OrderReviewFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class OrderReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  orderId: string;

  @ApiPropertyOptional({ example: 42, nullable: true, description: 'Human-facing number of the reviewed order' })
  @Expose()
  orderNumber: number | null;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  customerId: string;

  @ApiProperty()
  @Expose()
  customerName: string;

  @ApiProperty()
  @Expose()
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  comment: string | null;

  @ApiProperty()
  @Expose()
  isPublished: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description: 'Photos the customer attached to this review.',
  })
  @Expose()
  imageUrls: string[] | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: OrderReviewEntity): OrderReviewResponseDto {
    return plainToInstance(OrderReviewResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
