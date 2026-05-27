import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngredientDto {
  @ApiProperty({ example: 'Long Grain Rice', description: 'Ingredient display name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'kg', description: 'Unit of measure (e.g., kg, g, L, pcs)' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ example: 200, description: 'Starting stock quantity in the configured unit' })
  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @ApiPropertyOptional({ example: 20, description: 'Stock level that triggers a low-stock alert' })
  @IsOptional()
  @IsNumber()
  minStock?: number;

  @ApiPropertyOptional({ example: 850, description: 'Cost per unit in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  costPerUnit?: number;

  @ApiPropertyOptional({ format: 'uuid', example: 'sup1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'RICE-LG-001', description: 'Stock-keeping unit for this ingredient' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this ingredient belongs to' })
  @IsString()
  storeId: string;

  @ApiPropertyOptional({ example: '2024-01-10', description: 'Date of last restock (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  lastRestocked?: string;

  @ApiPropertyOptional({
    example: '2026-06-12',
    description: 'Best-before / use-by date for the current batch (ISO 8601 date)',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
