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

  @ApiPropertyOptional({ example: 'SCPS1 - Counter 1', description: 'Billing counter name' })
  @IsOptional()
  @IsString()
  counterName?: string;

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
  // All three are optional: a cashier physically counts the drawer (cash) and
  // often leaves card/transfer to reconcile against the ledger. An omitted
  // tender is treated as "matches expected", not as "nothing collected".
  @ApiPropertyOptional({ example: 12500, description: 'Cash counted in the drawer, including the opening float' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCash?: number;

  @ApiPropertyOptional({ example: 8000, description: 'Card/POS terminal total counted' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCard?: number;

  @ApiPropertyOptional({ example: 0, description: 'Transfer/wallet total counted' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualMobile?: number;

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
