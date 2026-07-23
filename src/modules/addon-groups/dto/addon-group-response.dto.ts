import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { AddOnGroupEntity } from '../entities/addon-group.entity';
import { AddOnEntity } from '../entities/addon.entity';
import { AddonIngredientEntity } from '../entities/addon-ingredient.entity';

export class AddOnIngredientResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  ingredientId: string;

  @ApiPropertyOptional({ nullable: true, example: 'Chicken' })
  @Expose()
  ingredientName: string | null;

  @ApiProperty({ example: 0.25 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: 'kg' })
  @Expose()
  unit: string;

  static from(entity: AddonIngredientEntity): AddOnIngredientResponseDto {
    return {
      id: entity.id,
      ingredientId: entity.ingredientId,
      ingredientName: entity.ingredient?.name ?? null,
      quantity: Number(entity.quantity),
      unit: entity.unit,
    };
  }
}

export class AddOnResponseDto {
  @ApiProperty({ format: 'uuid', example: 'ao1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Grilled Chicken' })
  @Expose()
  name: string;

  @ApiProperty({ example: 500.0 })
  @Expose()
  price: number;

  @ApiProperty({ example: true })
  @Expose()
  isAvailable: boolean;

  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  addOnGroupId: string;

  @ApiProperty({
    type: () => [AddOnIngredientResponseDto],
    description: 'Stock links consumed when this add-on is ordered',
  })
  @Expose()
  ingredients: AddOnIngredientResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: AddOnEntity): AddOnResponseDto {
    return plainToInstance(
      AddOnResponseDto,
      {
        ...entity,
        price: Number(entity.price),
        ingredients: (entity.addonIngredients ?? []).map(
          AddOnIngredientResponseDto.from,
        ),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class AddOnGroupResponseDto {
  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Proteins' })
  @Expose()
  name: string;

  @ApiProperty({ example: 0 })
  @Expose()
  minSelection: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @Expose()
  maxSelection: number | null;

  @ApiProperty({ example: true })
  @Expose()
  status: boolean;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Store this add-on group belongs to' })
  @Expose()
  storeId: string | null;

  @ApiProperty({ type: () => [AddOnResponseDto] })
  @Expose()
  @Type(() => AddOnResponseDto)
  addons: AddOnResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: AddOnGroupEntity): AddOnGroupResponseDto {
    return plainToInstance(
      AddOnGroupResponseDto,
      {
        ...entity,
        // Map nested add-ons through their own mapper: class-transformer's
        // @Type() only reshapes the plain object, it never calls
        // AddOnResponseDto.from, so the addonIngredients -> ingredients
        // rename would be silently dropped.
        addons: (entity.addons ?? []).map(AddOnResponseDto.from),
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: AddOnGroupEntity[]): AddOnGroupResponseDto[] {
    return entities.map((e) => AddOnGroupResponseDto.from(e));
  }
}
