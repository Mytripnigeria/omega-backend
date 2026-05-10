import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { MerchantWalletEntity } from '../entities/merchant-wallet.entity';
import {
  MerchantWalletTransactionEntity,
  MerchantWalletTxReason,
  MerchantWalletTxType,
} from '../entities/merchant-wallet-transaction.entity';

export class MerchantWalletResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 145600 })
  @Expose()
  balance: number;

  @ApiProperty({ example: 50000 })
  @Expose()
  reservedBalance: number;

  @ApiProperty({
    example: 95600,
    description: 'balance - reservedBalance — what the merchant can actually request as a payout.',
  })
  @Expose()
  availableBalance: number;

  @ApiProperty({ default: 'NGN' })
  @Expose()
  currency: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: MerchantWalletEntity): MerchantWalletResponseDto {
    const balance = Number(entity.balance ?? 0);
    const reserved = Number(entity.reservedBalance ?? 0);
    return plainToInstance(
      MerchantWalletResponseDto,
      {
        ...entity,
        balance,
        reservedBalance: reserved,
        availableBalance: Math.max(0, balance - reserved),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class MerchantWalletTxResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  walletId: string;

  @ApiProperty({ enum: ['credit', 'debit'] })
  @Expose()
  type: MerchantWalletTxType;

  @ApiProperty()
  @Expose()
  reason: MerchantWalletTxReason;

  @ApiProperty()
  @Expose()
  amount: number;

  @ApiProperty()
  @Expose()
  balanceAfter: number;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  linkedType: 'order' | 'payout' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  linkedId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  storeId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(
    entity: MerchantWalletTransactionEntity,
  ): MerchantWalletTxResponseDto {
    return plainToInstance(
      MerchantWalletTxResponseDto,
      {
        ...entity,
        amount: Number(entity.amount),
        balanceAfter: Number(entity.balanceAfter),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class MerchantWalletTxFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['credit', 'debit'] })
  @IsOptional()
  @IsEnum(['credit', 'debit'])
  type?: MerchantWalletTxType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  linkedId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
