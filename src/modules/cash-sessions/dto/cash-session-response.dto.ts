import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  CashSessionEntity,
  CashSessionStatus,
} from '../entities/cash-session.entity';

export class CashSessionResponseDto {
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
  staffId: string;

  @ApiProperty()
  @Expose()
  staffName: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  shiftId: string | null;

  @ApiProperty({ enum: ['open', 'closed', 'reviewed'] })
  @Expose()
  status: CashSessionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  openedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  closedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  reviewedAt: Date | null;

  @ApiProperty()
  @Expose()
  openingFloat: number;

  @ApiProperty()
  @Expose()
  expectedCash: number;

  @ApiProperty()
  @Expose()
  expectedCard: number;

  @ApiProperty()
  @Expose()
  expectedMobile: number;

  @ApiProperty()
  @Expose()
  expectedTotal: number;

  @ApiProperty()
  @Expose()
  actualCash: number;

  @ApiProperty()
  @Expose()
  actualCard: number;

  @ApiProperty()
  @Expose()
  actualMobile: number;

  @ApiProperty()
  @Expose()
  actualTotal: number;

  @ApiProperty()
  @Expose()
  difference: number;

  @ApiPropertyOptional({ enum: ['balanced', 'short', 'over'], nullable: true })
  @Expose()
  reconciliationStatus: 'balanced' | 'short' | 'over' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reviewedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reviewNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: CashSessionEntity): CashSessionResponseDto {
    return plainToInstance(
      CashSessionResponseDto,
      {
        ...entity,
        openingFloat: Number(entity.openingFloat),
        expectedCash: Number(entity.expectedCash),
        expectedCard: Number(entity.expectedCard),
        expectedMobile: Number(entity.expectedMobile),
        expectedTotal: Number(entity.expectedTotal),
        actualCash: Number(entity.actualCash),
        actualCard: Number(entity.actualCard),
        actualMobile: Number(entity.actualMobile),
        actualTotal: Number(entity.actualTotal),
        difference: Number(entity.difference),
      },
      { excludeExtraneousValues: true },
    );
  }
}

export class CashSessionStatsDto {
  @ApiProperty()
  openCount: number;

  @ApiProperty()
  closedCount: number;

  @ApiProperty()
  reviewedCount: number;

  @ApiProperty()
  balancedCount: number;

  @ApiProperty()
  shortCount: number;

  @ApiProperty()
  overCount: number;

  @ApiProperty()
  totalShortAmount: number;

  @ApiProperty()
  totalOverAmount: number;
}
