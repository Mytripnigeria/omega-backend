import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { ProductEntity } from '../entities/product.entity';
import { ProductVariationEntity } from '../entities/product-variation.entity';
import { ProductIngredientEntity } from '../entities/product-ingredient.entity';
import { AddOnGroupResponseDto } from '../../addon-groups/dto/addon-group-response.dto';

export class ProductVariationResponseDto {
  @ApiProperty({ format: 'uuid', example: 'v1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'p1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  productId: string;

  @ApiProperty({ example: 'Large' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'JR-LG', nullable: true })
  @Expose()
  sku: string | null;

  @ApiProperty({ example: 3500.0 })
  @Expose()
  price: number;

  @ApiProperty({ example: 4500.0 })
  @Expose()
  sellingPrice: number;

  @ApiProperty({ example: 20 })
  @Expose()
  stock: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ProductVariationEntity): ProductVariationResponseDto {
    return plainToInstance(ProductVariationResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

class EmbeddedIngredientSummaryDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'kg' })
  @Expose()
  unit: string;

  @ApiProperty({ example: 50.5 })
  @Expose()
  currentStock: number;
}

export class ProductIngredientResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  productId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  ingredientId: string;

  @ApiProperty({ example: 0.25 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: 'kg' })
  @Expose()
  unit: string;

  @ApiPropertyOptional({ type: () => EmbeddedIngredientSummaryDto, nullable: true })
  @Expose()
  @Type(() => EmbeddedIngredientSummaryDto)
  ingredient: EmbeddedIngredientSummaryDto | null;

  static from(entity: ProductIngredientEntity): ProductIngredientResponseDto {
    return plainToInstance(ProductIngredientResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid', example: 'p1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Jollof Rice (Large)' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ example: 'Smoky party jollof rice', nullable: true })
  @Expose()
  description: string | null;

  @ApiPropertyOptional({ example: 'JR-LG-001', nullable: true })
  @Expose()
  productCode: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  categoryId: string | null;

  @ApiProperty({ example: 3500.0 })
  @Expose()
  price: number;

  @ApiProperty({ example: 4500.0 })
  @Expose()
  sellingPrice: number;

  @ApiPropertyOptional({ example: 'JR-LG', nullable: true })
  @Expose()
  sku: string | null;

  @ApiProperty({ example: 25 })
  @Expose()
  stock: number;

  @ApiProperty({ example: true })
  @Expose()
  status: boolean;

  @ApiPropertyOptional({ example: 'SUP-001', nullable: true })
  @Expose()
  supplierId: string | null;

  @ApiPropertyOptional({ example: '15 mins', nullable: true })
  @Expose()
  prepTime: string | null;

  @ApiPropertyOptional({ example: 'inclusive', nullable: true })
  @Expose()
  taxOption: string | null;

  @ApiPropertyOptional({ example: 'none', nullable: true })
  @Expose()
  discountOption: string | null;

  @ApiPropertyOptional({ type: [String], example: ['pos', 'website'], nullable: true })
  @Expose()
  visibility: string[] | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/jollof-large.png', nullable: true })
  @Expose()
  imageUrl: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  imageFileId: string | null;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ type: () => [ProductVariationResponseDto] })
  @Expose()
  @Type(() => ProductVariationResponseDto)
  variations: ProductVariationResponseDto[];

  @ApiPropertyOptional({ type: () => [ProductIngredientResponseDto] })
  @Expose()
  @Type(() => ProductIngredientResponseDto)
  productIngredients: ProductIngredientResponseDto[];

  @ApiPropertyOptional({ type: () => [AddOnGroupResponseDto] })
  @Expose()
  @Type(() => AddOnGroupResponseDto)
  addonGroups: AddOnGroupResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ProductEntity): ProductResponseDto {
    return plainToInstance(ProductResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: ProductEntity[]): ProductResponseDto[] {
    return entities.map((e) => ProductResponseDto.from(e));
  }
}
