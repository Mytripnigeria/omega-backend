import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MinLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PayoutBankAccountEntity } from '../entities/payout-bank-account.entity';
import { PayoutEntity, PayoutStatus } from '../entities/payout.entity';

// ─── Bank accounts ───────────────────────────────────────────────────

export class CreatePayoutBankAccountDto {
  @ApiProperty({ example: 'Main account' })
  @IsString()
  @MinLength(1)
  label: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Length(10, 10, { message: 'NUBAN account numbers must be 10 digits' })
  @Matches(/^[0-9]{10}$/)
  accountNumber: string;

  @ApiProperty({ example: '058' })
  @IsString()
  @Length(3, 6)
  bankCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePayoutBankAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class PayoutBankAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  label: string;

  @ApiProperty()
  @Expose()
  accountNumber: string;

  @ApiProperty()
  @Expose()
  bankCode: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  bankName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  accountName: string | null;

  @ApiProperty()
  @Expose()
  currency: string;

  @ApiProperty()
  @Expose()
  isDefault: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: PayoutBankAccountEntity): PayoutBankAccountResponseDto {
    return plainToInstance(PayoutBankAccountResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}

// ─── Payouts ────────────────────────────────────────────────────────

export class CreatePayoutDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bankAccountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PayoutFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: [
      'pending',
      'queued',
      'processing',
      'success',
      'failed',
      'cancelled',
    ],
  })
  @IsOptional()
  @IsEnum([
    'pending',
    'queued',
    'processing',
    'success',
    'failed',
    'cancelled',
  ])
  status?: PayoutStatus;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class PayoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  reference: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  bankAccountId: string;

  @ApiProperty()
  @Expose()
  amount: number;

  @ApiProperty()
  @Expose()
  currency: string;

  @ApiProperty()
  @Expose()
  status: PayoutStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  providerTransferCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  providerStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  failureReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  requestedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  requestedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  note: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  queuedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  processingAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  settledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  bankAccount: PayoutBankAccountResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: PayoutEntity,
    bankAccount?: PayoutBankAccountEntity | null,
  ): PayoutResponseDto {
    return plainToInstance(
      PayoutResponseDto,
      {
        ...entity,
        amount: Number(entity.amount),
        bankAccount: bankAccount
          ? PayoutBankAccountResponseDto.from(bankAccount)
          : null,
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class PayoutStatsDto {
  @ApiProperty({ example: 500000 })
  totalPaidOut: number;

  @ApiProperty({ example: 50000 })
  totalPending: number;

  @ApiProperty({ example: 12 })
  successCount: number;

  @ApiProperty({ example: 1 })
  failedCount: number;

  @ApiProperty({ example: 3 })
  inFlightCount: number;
}
