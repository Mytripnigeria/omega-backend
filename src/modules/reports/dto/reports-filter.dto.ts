import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ReportsRangeDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class SalesReportFilterDto extends ReportsRangeDto {
  @ApiPropertyOptional({
    enum: ['hour', 'day', 'week', 'month'],
    example: 'day',
    description: 'Bucket granularity. Use `hour` for intraday reports like Daily Sales.',
  })
  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'])
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export class DashboardSummaryFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class ExportReportFilterDto extends ReportsRangeDto {
  @ApiPropertyOptional({
    enum: ['sales', 'top-products', 'food-cost', 'waste', 'stock'],
  })
  @IsOptional()
  @IsEnum(['sales', 'top-products', 'food-cost', 'waste', 'stock'])
  type?: string;

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'], default: 'xlsx' })
  @IsOptional()
  @IsEnum(['xlsx', 'pdf'])
  format?: string;

  @ApiPropertyOptional({ description: 'Label printed on the document.' })
  @IsOptional()
  @IsString()
  storeName?: string;
}

export class TopProductsFilterDto extends ReportsRangeDto {
  @ApiPropertyOptional({ example: 5, default: 5, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
