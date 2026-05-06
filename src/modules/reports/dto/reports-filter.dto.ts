import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
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
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], example: 'day' })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class DashboardSummaryFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;
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
