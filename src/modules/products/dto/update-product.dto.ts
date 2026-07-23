import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreateProductDto, CreateVariationDto } from './create-product.dto';
import { IsBoolean } from 'class-validator';

/**
 * `ingredients` and `addonGroupIds` are intentionally kept here (unlike
 * `variations`, which has its own sub-resource endpoints): the merchant hub
 * edits a product's whole recipe in one form, and previously omitting them
 * meant PATCH silently discarded the recipe — "it says updated but doesn't
 * change". When present, each is treated as the complete replacement set.
 */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variations'] as const),
) {}

export class UpdateVariationDto extends PartialType(CreateVariationDto) {}

export class ToggleProductStatusDto {
  @ApiProperty({ example: false, description: 'true = available for sale; false = hidden/sold out' })
  @IsBoolean()
  status: boolean;
}
