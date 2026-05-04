import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto, CreateVariationDto } from './create-product.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variations', 'ingredients', 'addonGroupIds'] as const),
) {}

export class UpdateVariationDto extends PartialType(CreateVariationDto) {}

export class ToggleProductStatusDto {
  @IsBoolean()
  status: boolean;
}
