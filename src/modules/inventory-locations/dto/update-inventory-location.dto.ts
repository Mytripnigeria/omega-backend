import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateInventoryLocationDto } from './create-inventory-location.dto';

export class UpdateInventoryLocationDto extends PartialType(
  OmitType(CreateInventoryLocationDto, ['storeId'] as const),
) {}
