import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class OpenCashSessionDto {
  @ApiProperty({ example: 5000, description: 'Opening cash float in the drawer' })
  @IsNumber()
  @Min(0)
  openingFloat: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional linked shift' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashSessionDto {
  @ApiProperty({ example: 12500 })
  @IsNumber()
  @Min(0)
  actualCash: number;

  @ApiProperty({ example: 8000 })
  @IsNumber()
  @Min(0)
  actualCard: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  actualMobile: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewCashSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class CashSessionFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ enum: ['open', 'closed', 'reviewed'] })
  @IsOptional()
  @IsEnum(['open', 'closed', 'reviewed'])
  status?: 'open' | 'closed' | 'reviewed';

  @ApiPropertyOptional({ enum: ['balanced', 'short', 'over'] })
  @IsOptional()
  @IsEnum(['balanced', 'short', 'over'])
  reconciliationStatus?: 'balanced' | 'short' | 'over';

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
