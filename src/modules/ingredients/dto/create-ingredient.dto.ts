import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  name: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;

  @IsOptional()
  @IsNumber()
  costPerUnit?: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  storeId: string;

  @IsOptional()
  @IsDateString()
  lastRestocked?: string;
}
