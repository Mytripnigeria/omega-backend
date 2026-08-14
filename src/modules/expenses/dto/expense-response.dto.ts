import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  ExpenseCategory,
  ExpenseEntity,
  ExpenseItem,
  ExpenseStatus,
} from '../entities/expense.entity';

export class ExpenseResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  requestedById: string;

  @ApiProperty()
  @Expose()
  requestedByName: string;

  @ApiProperty({ enum: ExpenseCategory })
  @Expose()
  category: ExpenseCategory;

  @ApiProperty({ example: 12500 })
  @Expose()
  amount: number;

  @ApiProperty({ example: 'NGN' })
  @Expose()
  currency: string;

  @ApiProperty()
  @Expose()
  description: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    nullable: true,
    description: 'Line items making up this submission.',
  })
  @Expose()
  items: ExpenseItem[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  supplierName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  receiptFileId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  receiptUrl: string | null;

  @ApiProperty({ enum: ExpenseStatus })
  @Expose()
  status: ExpenseStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reviewedByName: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reviewNotes: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  paidAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  paymentMethodId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ExpenseEntity): ExpenseResponseDto {
    return plainToInstance(
      ExpenseResponseDto,
      { ...entity, amount: Number(entity.amount) },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: ExpenseEntity[]): ExpenseResponseDto[] {
    return entities.map((e) => ExpenseResponseDto.from(e));
  }
}
