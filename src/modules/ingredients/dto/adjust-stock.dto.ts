import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ example: -5, description: 'Delta to apply to currentStock. Positive = restock, negative = consumption or wastage.' })
  @IsNumber()
  adjustment: number;

  @ApiPropertyOptional({ example: 'Wastage — spoiled during storage', description: 'Optional note recorded in the audit trail' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: '2026-06-12',
    description:
      'New best-before / use-by date for the current batch (ISO 8601 date). Typically set when receiving new stock; only honoured on positive `adjustment` (intake).',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
