import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAddOnGroupDto, CreateAddOnDto } from './create-addon-group.dto';

export class UpdateAddOnGroupDto extends PartialType(
  OmitType(CreateAddOnGroupDto, ['addons'] as const),
) {}

export class UpdateAddOnDto extends PartialType(CreateAddOnDto) {}
