import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterPrinterDto {
  @ApiPropertyOptional({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Filter printers by store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
