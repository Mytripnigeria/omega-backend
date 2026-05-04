import { IsOptional, IsUUID } from 'class-validator';

export class FilterPrinterDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
