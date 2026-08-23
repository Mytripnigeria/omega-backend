import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** numeric(15,2) tops out just below 10^13. */
export const MAX_MONEY = 9_999_999_999_999.99;
/** Postgres int4 upper bound, for stock counters. */
export const MAX_INT4 = 2_147_483_647;

export class CreateVariationDto {
  @ApiProperty({ example: 'Large', description: 'Variation display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'JOLLOF-L', description: 'Stock-keeping unit for this variation' })
  @IsOptional()
  @IsString()
  sku?: string;

  // Bounds match the columns: numeric(15,2) rejects anything from 10^13 up and
  // stock is a plain int. Without them an out-of-range figure reached Postgres
  // and came back as a bare 500 "internal server error" on the products form —
  // with no clue which field was at fault.
  @ApiPropertyOptional({ example: 2500, description: 'Cost price in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  price?: number;

  @ApiPropertyOptional({ example: 3200, description: 'Selling price in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 50, description: 'Initial stock quantity for this variation' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_INT4)
  stock?: number;
}

export class CreateProductIngredientDto {
  @ApiProperty({ example: 'ing1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'IngredientEntity ID' })
  @IsString()
  ingredientId: string;

  @ApiProperty({ example: 0.5, description: 'Quantity consumed per unit sold' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unit of measure matching the ingredient\'s unit' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Scope this recipe line to a single variation. Omit (or null) for the ' +
      'product-level default recipe, which is used by products that have no ' +
      'variation-scoped recipe.',
  })
  @IsOptional()
  @IsUUID()
  variationId?: string | null;

  @ApiPropertyOptional({
    example: 'Large',
    description:
      'Alternative to variationId when creating a product and its variations ' +
      'in the same request — matched (case-insensitively) against the ' +
      'variation names in this payload.',
  })
  @IsOptional()
  @IsString()
  variationName?: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Jollof Rice' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Smoky party-style jollof rice served with assorted proteins' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'JR-001', description: 'Internal product code for POS display' })
  @IsOptional()
  @IsString()
  productCode?: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'cat1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Category to assign this product to' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 1800, description: 'Cost price in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  price?: number;

  @ApiPropertyOptional({ example: 2500, description: 'Selling price in kobo (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 'JOLLOF-001', description: 'Stock-keeping unit' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 100, description: 'Initial stock quantity (for non-ingredient-tracked products)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_INT4)
  stock?: number;

  @ApiPropertyOptional({ example: true, description: 'true = available for sale; false = hidden/sold out' })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ format: 'uuid', example: 'sup1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: '15 mins', description: 'Preparation time displayed to kitchen staff' })
  @IsOptional()
  @IsString()
  prepTime?: string;

  @ApiPropertyOptional({ example: 'vat', description: 'Tax configuration key applied to this product' })
  @IsOptional()
  @IsString()
  taxOption?: string;

  @ApiPropertyOptional({ example: 'none', description: 'Discount configuration key applied to this product' })
  @IsOptional()
  @IsString()
  discountOption?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['pos', 'website'],
    description: 'Channels where this product is visible',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibility?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.mrjollof.com/products/jollof.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'FileEntity ID for the product image' })
  @IsOptional()
  @IsUUID()
  imageFileId?: string | null;

  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this product belongs to' })
  @IsString()
  storeId: string;

  @ApiPropertyOptional({
    type: () => [CreateVariationDto],
    description: 'Size or other variations for this product',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariationDto)
  variations?: CreateVariationDto[];

  @ApiPropertyOptional({
    type: () => [CreateProductIngredientDto],
    description: 'Ingredient links for kitchen stock deduction',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductIngredientDto)
  ingredients?: CreateProductIngredientDto[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Addon group IDs to associate with this product',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addonGroupIds?: string[];
}
