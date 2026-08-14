import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateProductDto, CreateVariationDto } from './create-product.dto';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

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

/**
 * One row of the desired variation set. Carrying `id` means "this existing
 * variation, edited"; omitting it means "add this one".
 */
export class SyncVariationDto extends CreateVariationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Existing variation to update. Omit to create a new one.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;
}

/**
 * The complete variation set a product should end up with.
 *
 * The merchant hub edits every variation in one form, so it saves them in one
 * request: sending them one-at-a-time meant a single failure aborted the rest
 * (leaving the product half-saved), and edits to existing variations were
 * never sent at all — the form reported success while nothing changed.
 */
export class SyncVariationsDto {
  @ApiProperty({ type: [SyncVariationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncVariationDto)
  variations: SyncVariationDto[];
}

export class ToggleProductStatusDto {
  @ApiProperty({ example: false, description: 'true = available for sale; false = hidden/sold out' })
  @IsBoolean()
  status: boolean;
}
