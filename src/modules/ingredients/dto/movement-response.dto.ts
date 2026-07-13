import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IngredientMovementEntity,
  MovementType,
} from '../entities/ingredient-movement.entity';

export class IngredientMovementResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  ingredientId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  staffName: string | null;

  @ApiProperty({ enum: MovementType })
  @Expose()
  type: MovementType;

  @ApiProperty({ example: 5.0 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: 50.0 })
  @Expose()
  previousStock: number;

  @ApiProperty({ example: 55.0 })
  @Expose()
  newStock: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reason: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  referenceType: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  referenceId: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Sending location (transfers)' })
  @Expose()
  fromLocationName: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Receiving location (transfers)' })
  @Expose()
  toLocationName: string | null;

  @ApiPropertyOptional({ description: 'Denormalised ingredient name for display' })
  @Expose()
  ingredientName: string | null;

  @ApiPropertyOptional({ description: 'Denormalised ingredient unit for display' })
  @Expose()
  ingredientUnit: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: IngredientMovementEntity): IngredientMovementResponseDto {
    return plainToInstance(
      IngredientMovementResponseDto,
      {
        ...entity,
        quantity: Number(entity.quantity),
        previousStock: Number(entity.previousStock),
        newStock: Number(entity.newStock),
        ingredientName: entity.ingredient?.name ?? null,
        ingredientUnit: entity.ingredient?.unit ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(
    entities: IngredientMovementEntity[],
  ): IngredientMovementResponseDto[] {
    return entities.map((e) => IngredientMovementResponseDto.from(e));
  }
}
