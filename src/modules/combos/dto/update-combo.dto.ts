import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateComboDto } from './create-combo.dto';
import { IsBoolean } from 'class-validator';

export class UpdateComboDto extends PartialType(
  OmitType(CreateComboDto, ['products'] as const),
) {}

export class ToggleComboStatusDto {
  @IsBoolean()
  isActive: boolean;
}
