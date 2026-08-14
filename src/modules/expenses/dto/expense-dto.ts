import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ExpenseCategory,
  ExpenseItemType,
  ExpenseStatus,
} from '../entities/expense.entity';

export class ExpenseItemDto {
  @ApiProperty({ example: 'Gas cylinder' })
  @IsString()
  name: string;

  @ApiProperty({
    enum: ExpenseItemType,
    example: ExpenseItemType.PURCHASE,
    description: '`purchase` = stock bought in; `expense` = money spent.',
  })
  @IsEnum(ExpenseItemType)
  type: ExpenseItemType;

  @ApiPropertyOptional({ example: 'kg', nullable: true })
  @IsOptional()
  @IsString()
  unit?: string | null;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 6250 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    example: 'Kunle Gas Ltd',
    nullable: true,
    description: 'Supplier for this line; falls back to the submission supplier.',
  })
  @IsOptional()
  @IsString()
  supplier?: string | null;
}

export class CreateExpenseDto {
  /**
   * Line items making up the submission. When supplied, `amount` is computed
   * from them server-side (quantity × unitPrice, summed) so the stored total
   * can never disagree with the lines it's made of.
   */
  @ApiPropertyOptional({ type: [ExpenseItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  items?: ExpenseItemDto[];

  @ApiPropertyOptional({ example: 'Kunle Gas Ltd' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.SUPPLIES })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiPropertyOptional({
    example: 12500,
    description: 'Ignored when `items` are supplied — the total is summed from them.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'NGN', description: 'ISO 4217 currency code; defaults to business currency' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: 'Replacement gas cylinder for kitchen',
    description: 'Optional once `items` are supplied.',
  })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ type: [ExpenseItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  items?: ExpenseItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;
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
