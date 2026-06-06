import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { IngredientEntity } from '../entities/ingredient.entity';
import { IngredientLocationStockEntity } from '../entities/ingredient-location-stock.entity';

export class IngredientLocationStockResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  locationId!: string;

  @ApiProperty({ example: 50.5 })
  @Expose()
  currentStock!: number;

  @ApiProperty({ example: 5 })
  @Expose()
  minStock!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastRestocked!: Date | null;

  @ApiPropertyOptional({ example: '2026-06-12', nullable: true })
  @Expose()
  expiryDate!: string | null;

  static from(entity: IngredientLocationStockEntity): IngredientLocationStockResponseDto {
    return plainToInstance(
      IngredientLocationStockResponseDto,
      {
        ...entity,
        currentStock: Number(entity.currentStock),
        minStock: Number(entity.minStock),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class IngredientResponseDto {
  @ApiProperty({ format: 'uuid', example: 'i1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'kg' })
  @Expose()
  unit: string;

  @ApiProperty({ example: 50.5, description: 'Aggregate stock summed across all locations.' })
  @Expose()
  currentStock: number;

  @ApiProperty({ example: 10.0, description: 'Aggregate minimum stock summed across locations.' })
  @Expose()
  minStock: number;

  @ApiProperty({ example: 1200.0 })
  @Expose()
  costPerUnit: number;

  @ApiPropertyOptional({ example: 'SUP-002', nullable: true, deprecated: true })
  @Expose()
  supplierId: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @Expose()
  supplierIds!: string[] | null;

  @ApiPropertyOptional({ example: 'RI-LG-001', nullable: true })
  @Expose()
  sku: string | null;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastRestocked: Date | null;

  @ApiPropertyOptional({
    example: '2026-06-12',
    nullable: true,
    description: 'Aggregate best-before date (earliest of any location).',
  })
  @Expose()
  expiryDate: string | null;

  @ApiPropertyOptional({
    type: () => [IngredientLocationStockResponseDto],
    description:
      'Per-location stock entries. Empty for legacy ingredients that have not yet been tied to any location.',
  })
  @Expose()
  @Type(() => IngredientLocationStockResponseDto)
  locations!: IngredientLocationStockResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: IngredientEntity & { locations?: IngredientLocationStockEntity[] },
  ): IngredientResponseDto {
    const locations = (entity.locations ?? []).map(
      IngredientLocationStockResponseDto.from,
    );
    return plainToInstance(
      IngredientResponseDto,
      { ...entity, locations },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(
    entities: (IngredientEntity & { locations?: IngredientLocationStockEntity[] })[],
  ): IngredientResponseDto[] {
    return entities.map((e) => IngredientResponseDto.from(e));
  }
}
