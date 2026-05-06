import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  FinancialTransactionEntity,
  TransactionMethod,
  TransactionPurpose,
  TransactionType,
} from '../entities/financial-transaction.entity';

export class FinancialTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  storeId: string | null;

  @ApiProperty({ enum: ['credit', 'debit'] })
  @Expose()
  type: TransactionType;

  @ApiProperty()
  @Expose()
  purpose: TransactionPurpose;

  @ApiProperty({ example: 5000 })
  @Expose()
  amount: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  method: TransactionMethod | null;

  @ApiProperty({ default: 'NGN' })
  @Expose()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reference: string | null;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  linkedType: 'order' | 'wallet_tx' | 'expense' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  linkedId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  customerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customerName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  staffName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(
    entity: FinancialTransactionEntity,
  ): FinancialTransactionResponseDto {
    return plainToInstance(
      FinancialTransactionResponseDto,
      { ...entity, amount: Number(entity.amount) },
      { excludeExtraneousValues: true },
    );
  }
}

export class FinancialTransactionStatsDto {
  @ApiProperty({ example: 145600 })
  totalIn: number;

  @ApiProperty({ example: 32500 })
  totalOut: number;

  @ApiProperty({ example: 28000 })
  pending: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { cash: 50000, paystack: 95600 },
  })
  byMethod: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { order_payment: 145600, order_refund: 4000 },
  })
  byPurpose: Record<string, number>;
}
