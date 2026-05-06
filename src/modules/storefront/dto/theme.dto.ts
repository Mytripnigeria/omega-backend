import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsHexColor,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { StorefrontThemePresetEntity } from '../entities/storefront-theme-preset.entity';

export class CreateThemePresetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '#3B82F6' })
  @IsHexColor()
  primaryColor: string;

  @ApiProperty({ example: '#1F2937' })
  @IsHexColor()
  secondaryColor: string;

  @ApiProperty({ example: '#F59E0B' })
  @IsHexColor()
  accentColor: string;

  @ApiProperty({ example: '#FFFFFF' })
  @IsHexColor()
  backgroundColor: string;

  @ApiProperty({ example: '#0F172A' })
  @IsHexColor()
  foregroundColor: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  fontFamily?: string;
}

export class ThemePresetResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  businessId: string | null;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty()
  @Expose()
  primaryColor: string;

  @ApiProperty()
  @Expose()
  secondaryColor: string;

  @ApiProperty()
  @Expose()
  accentColor: string;

  @ApiProperty()
  @Expose()
  backgroundColor: string;

  @ApiProperty()
  @Expose()
  foregroundColor: string;

  @ApiProperty()
  @Expose()
  fontFamily: string;

  @ApiProperty()
  @Expose()
  isSystem: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StorefrontThemePresetEntity): ThemePresetResponseDto {
    return plainToInstance(ThemePresetResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
