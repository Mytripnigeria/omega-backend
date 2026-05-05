import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePrinterDto } from './create-printer.dto';

export class UpdatePrinterDto extends PartialType(
  OmitType(CreatePrinterDto, ['storeId'] as const),
) {}
