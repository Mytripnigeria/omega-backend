import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  PageStatus,
  PageTemplate,
  StorefrontPageEntity,
} from '../entities/storefront-page.entity';

export class CreateStorefrontPageDto {
  @ApiProperty({ example: 'About Us' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'about', description: 'URL-safe slug, unique per business' })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'Slug must be lowercase letters, numbers, and dashes',
  })
  slug: string;

  @ApiProperty({ enum: PageTemplate, default: PageTemplate.STANDARD })
  @IsEnum(PageTemplate)
  template: PageTemplate;

  @ApiPropertyOptional({ enum: PageStatus, default: PageStatus.DRAFT })
  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateStorefrontPageDto extends PartialType(CreateStorefrontPageDto) {}

export class StorefrontPageFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PageStatus })
  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;

  @ApiPropertyOptional({ enum: PageTemplate })
  @IsOptional()
  @IsEnum(PageTemplate)
  template?: PageTemplate;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReorderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

export class StorefrontPageResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  slug: string;

  @ApiProperty({ enum: PageTemplate })
  @Expose()
  template: PageTemplate;

  @ApiProperty({ enum: PageStatus })
  @Expose()
  status: PageStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  metaTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  metaDescription: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  content: string | null;

  @ApiProperty()
  @Expose()
  position: number;

  @ApiProperty()
  @Expose()
  views: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StorefrontPageEntity): StorefrontPageResponseDto {
    return plainToInstance(StorefrontPageResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
