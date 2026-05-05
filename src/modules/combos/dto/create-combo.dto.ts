import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComboItemDto {
  @ApiProperty({ format: 'uuid', example: 'pr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'ProductEntity ID to include in the combo' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: 1, description: 'Quantity of this product in the combo (defaults to 1)' })
  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class CreateComboDto {
  @ApiProperty({ example: 'Family Feast Deal', description: 'Combo display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Jollof Rice + Chicken + Plantain + Drinks for 4' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 3800, description: 'Discounted combo price in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 4500, description: 'Sum of individual item prices before the combo discount' })
  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether the combo is currently available for sale' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.mrjollof.com/combos/family-feast.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'FileEntity ID for the combo image' })
  @IsOptional()
  @IsUUID()
  imageFileId?: string | null;

  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this combo belongs to' })
  @IsString()
  storeId: string;

  @ApiPropertyOptional({
    type: () => [CreateComboItemDto],
    description: 'Products and their quantities in this combo',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComboItemDto)
  products?: CreateComboItemDto[];
}
