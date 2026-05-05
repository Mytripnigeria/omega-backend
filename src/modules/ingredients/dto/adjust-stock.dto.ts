import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ example: -5, description: 'Delta to apply to currentStock. Positive = restock, negative = consumption or wastage.' })
  @IsNumber()
  adjustment: number;

  @ApiPropertyOptional({ example: 'Wastage — spoiled during storage', description: 'Optional note recorded in the audit trail' })
  @IsOptional()
  @IsString()
  reason?: string;
}
