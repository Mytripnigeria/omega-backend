import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { IngredientEntity } from '../entities/ingredient.entity';

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

  @ApiProperty({ example: 50.5 })
  @Expose()
  currentStock: number;

  @ApiProperty({ example: 10.0 })
  @Expose()
  minStock: number;

  @ApiProperty({ example: 1200.0 })
  @Expose()
  costPerUnit: number;

  @ApiPropertyOptional({ example: 'SUP-002', nullable: true })
  @Expose()
  supplierId: string | null;

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

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: IngredientEntity): IngredientResponseDto {
    return plainToInstance(IngredientResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: IngredientEntity[]): IngredientResponseDto[] {
    return entities.map((e) => IngredientResponseDto.from(e));
  }
}
