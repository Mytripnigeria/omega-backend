import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FinancialTransactionFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: ['credit', 'debit'] })
  @IsOptional()
  @IsEnum(['credit', 'debit'])
  type?: 'credit' | 'debit';

  @ApiPropertyOptional({
    description: 'Comma-separated list of purposes',
    example: 'order_payment,order_refund',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of methods',
    example: 'cash,paystack',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  linkedId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
