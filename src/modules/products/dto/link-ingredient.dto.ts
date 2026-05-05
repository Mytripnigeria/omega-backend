import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkIngredientDto {
  @ApiProperty({ format: 'uuid', example: 'ing1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'IngredientEntity ID to link' })
  @IsString()
  ingredientId: string;

  @ApiProperty({ example: 0.5, description: 'Quantity of the ingredient consumed per product sold' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unit of measure (must match the ingredient\'s configured unit)' })
  @IsString()
  unit: string;
}
