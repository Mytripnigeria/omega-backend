import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from '../entities/wallet-transaction.entity';

export class WalletTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  customerId: string;

  @ApiProperty({ enum: WalletTransactionType })
  @Expose()
  type: WalletTransactionType;

  @ApiProperty({ example: 5000 })
  @Expose()
  amount: number;

  @ApiProperty({ example: 12500 })
  @Expose()
  balance: number;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reference: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: WalletTransactionEntity): WalletTransactionResponseDto {
    return plainToInstance(
      WalletTransactionResponseDto,
      {
        ...entity,
        amount: Number(entity.amount),
        balance: Number(entity.balance),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class PointsTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  customerId: string;

  @ApiProperty({ enum: PointsTransactionType })
  @Expose()
  type: PointsTransactionType;

  @ApiProperty({ example: 500 })
  @Expose()
  points: number;

  @ApiProperty({ example: 1500 })
  @Expose()
  balance: number;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  orderId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: PointsTransactionEntity): PointsTransactionResponseDto {
    return plainToInstance(PointsTransactionResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
