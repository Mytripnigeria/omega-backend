import { PartialType } from '@nestjs/mapped-types';
import { CreateVariationGroupDto } from './create-variation-group.dto';

export class UpdateVariationGroupDto extends PartialType(CreateVariationGroupDto) {}
