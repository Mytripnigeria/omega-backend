import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

export class OrderFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of statuses, e.g. `pending,preparing`',
    example: 'pending,preparing',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['pos', 'website', 'phone'] })
  @IsOptional()
  @IsEnum(['pos', 'website', 'phone'])
  channel?: 'pos' | 'website' | 'phone';

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

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Customer changed mind' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecordPaymentDto {
  @ApiPropertyOptional({ example: 4837.5 })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    enum: ['paystack', 'card', 'cash', 'wallet', 'points'],
    description:
      'Payment channel for this transaction. Stored on the order if not already set.',
  })
  @IsOptional()
  @IsEnum(['paystack', 'card', 'cash', 'wallet', 'points'])
  paymentChannel?: 'paystack' | 'card' | 'cash' | 'wallet' | 'points';

  @ApiPropertyOptional({
    description: 'Provider reference (Paystack reference, transfer slip, etc.)',
  })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class UpdatePrepStatusDto {
  @ApiPropertyOptional({ enum: ['pending', 'preparing', 'ready'] })
  @IsEnum(['pending', 'preparing', 'ready'])
  prepStatus: 'pending' | 'preparing' | 'ready';
}

export class RefundOrderDto {
  @ApiPropertyOptional({
    example: 2500,
    description:
      'Amount to refund. Must be > 0 and <= (paidAmount - refundedAmount).',
  })
  amount: number;

  @ApiPropertyOptional({ example: 'Wrong item delivered' })
  @IsOptional()
  @IsString()
  reason?: string;
}
