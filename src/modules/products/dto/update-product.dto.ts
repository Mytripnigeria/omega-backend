import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreateProductDto, CreateVariationDto } from './create-product.dto';
import { IsBoolean } from 'class-validator';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variations', 'ingredients', 'addonGroupIds'] as const),
) {}

export class UpdateVariationDto extends PartialType(CreateVariationDto) {}

export class ToggleProductStatusDto {
  @ApiProperty({ example: false, description: 'true = available for sale; false = hidden/sold out' })
  @IsBoolean()
  status: boolean;
}
