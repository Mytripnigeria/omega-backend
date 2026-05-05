import { PartialType } from '@nestjs/swagger';
import { CreateVariationGroupDto } from './create-variation-group.dto';

export class UpdateVariationGroupDto extends PartialType(CreateVariationGroupDto) {}
