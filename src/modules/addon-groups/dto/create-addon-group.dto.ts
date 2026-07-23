import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddOnIngredientDto {
  @ApiProperty({ example: 'ing1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'IngredientEntity ID' })
  @IsString()
  ingredientId: string;

  @ApiProperty({ example: 0.25, description: 'Quantity consumed each time this add-on is selected' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unit of measure matching the ingredient unit' })
  @IsString()
  unit: string;
}

export class CreateAddOnDto {
  @ApiProperty({ example: 'Extra Chicken', description: 'Addon display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 500, description: 'Addon price in kobo (NGN). Defaults to 0 (free).' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether this addon is currently available for selection' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    type: () => [CreateAddOnIngredientDto],
    description:
      'Stock links for this add-on. Selecting the add-on on an order deducts ' +
      'these ingredients, so "Extra Chicken" actually consumes chicken. ' +
      'Sending the array replaces this add-on whole recipe.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddOnIngredientDto)
  ingredients?: CreateAddOnIngredientDto[];
}

export class CreateAddOnGroupDto {
  @ApiProperty({ example: 'Proteins', description: 'Addon group display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 0, description: 'Minimum number of addons the customer must select (0 = optional)' })
  @IsOptional()
  @IsNumber()
  minSelection?: number;

  @ApiPropertyOptional({ example: 3, description: 'Maximum number of addons the customer can select (0 = unlimited)' })
  @IsOptional()
  @IsNumber()
  maxSelection?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether this addon group is active and visible' })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({
    type: () => [CreateAddOnDto],
    example: [
      { name: 'Extra Chicken', price: 500 },
      { name: 'Extra Fish', price: 400 },
      { name: 'Extra Plantain', price: 200 },
    ],
    description: 'Initial addons to create inside this group',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddOnDto)
  addons?: CreateAddOnDto[];
}
