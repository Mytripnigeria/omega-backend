import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreateComboDto } from './create-combo.dto';
import { IsBoolean } from 'class-validator';

export class UpdateComboDto extends PartialType(
  OmitType(CreateComboDto, ['products'] as const),
) {}

export class ToggleComboStatusDto {
  @ApiProperty({ example: false, description: 'true = combo is active and available for sale' })
  @IsBoolean()
  isActive: boolean;
}
