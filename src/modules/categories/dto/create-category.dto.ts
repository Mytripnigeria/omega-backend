import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from '../entities/category.entity';

export class CreateCategoryDto {
  /** Display name. Must be unique within the (business, type) pair. */
  @ApiProperty({ example: 'Mains', description: 'Display name for the category' })
  @IsString()
  name: string;

  /** Category domain. Defaults to "menu" when omitted. */
  @ApiPropertyOptional({
    enum: CategoryType,
    example: CategoryType.MENU,
    description: 'Which workstation surface this category belongs to',
  })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  /** Single emoji shown next to the category. */
  @ApiPropertyOptional({ example: '🍽️', description: 'Display emoji (1 char, optional)' })
  @IsOptional()
  @IsString()
  emoji?: string;

  /** Long-form description shown to staff. */
  @ApiPropertyOptional({ example: 'Hearty mains served with sides' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Direct image URL (use `imageFileId` instead when uploading via the storage service). */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/cat-mains.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** ID of an uploaded file in the storage module — resolves `imageUrl` server-side. */
  @ApiPropertyOptional({ example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  imageFileId?: string | null;

  /** Show the category on customer-facing surfaces. Default true. */
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Sort order; lower comes first. */
  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  /** Channels this category is exposed to (e.g. ["pos", "website"]). */
  @ApiPropertyOptional({ example: ['pos', 'website'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibility?: string[];
}
