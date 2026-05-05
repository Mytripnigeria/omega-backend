import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { ExpenseCategory, ExpenseStatus } from '../entities/expense.entity';

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.SUPPLIES })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: 12500 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'NGN', description: 'ISO 4217 currency code; defaults to business currency' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Replacement gas cylinder for kitchen' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'FileEntity ID for an uploaded receipt' })
  @IsOptional()
  @IsUUID()
  receiptFileId?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  receiptFileId?: string;
}

export class ReviewExpenseDto {
  @ApiPropertyOptional({ example: 'Approved — keep receipt for audit.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkPaidExpenseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;
}

export class ExpenseFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of statuses, e.g. `pending,approved`',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
