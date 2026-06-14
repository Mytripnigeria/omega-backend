import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitialLocationStockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional()
  @IsNumber()
  minStock?: number;

  @ApiPropertyOptional({ example: '2026-06-12' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateIngredientDto {
  @ApiProperty({ example: 'Long Grain Rice', description: 'Ingredient display name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'kg', description: 'Unit of measure (e.g., kg, g, L, pcs)' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ example: 200, description: 'Aggregate starting stock (sum across locations). If `locations` is provided, this is recomputed from those rows.' })
  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @ApiPropertyOptional({ example: 20, description: 'Aggregate stock-alert threshold' })
  @IsOptional()
  @IsNumber()
  minStock?: number;

  @ApiPropertyOptional({ example: 850, description: 'Cost per unit in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  costPerUnit?: number;

  @ApiPropertyOptional({
    example: 'ingredient',
    description: 'Inventory variant/type: ingredient, packaging, premix, hygiene, etc.',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    deprecated: true,
    description: 'Legacy single-supplier reference. Prefer `supplierIds`. When both are given, `supplierIds` wins.',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Supplier UUIDs that supply this ingredient. Multi-select on the merchant hub.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  supplierIds?: string[];

  @ApiPropertyOptional({
    type: () => [InitialLocationStockDto],
    description:
      'Initial per-location stock rows. The aggregate `currentStock`/`minStock` on the ingredient are derived from these (sum of stocks; sum of minStocks).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialLocationStockDto)
  locations?: InitialLocationStockDto[];

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
    description: 'Aggregate best-before / use-by date',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
