import { IsString, IsNumber } from 'class-validator';

export class LinkIngredientDto {
  @IsString()
  ingredientId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;
}
