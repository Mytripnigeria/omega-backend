import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { BusinessSettingsEntity } from '../entities/business-settings.entity';

export class BusinessSettingsResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiPropertyOptional({ example: 'Thank you for dining with us!', nullable: true })
  @Expose()
  receiptHeader: string | null;

  @ApiPropertyOptional({ example: 'Visit us again at mrjollof.com', nullable: true })
  @Expose()
  receiptFooter: string | null;

  @ApiProperty({ example: true })
  @Expose()
  receiptShowLogo: boolean;

  @ApiProperty({ example: true })
  @Expose()
  receiptShowItemPrices: boolean;

  @ApiProperty({ example: true })
  @Expose()
  receiptShowTaxBreakdown: boolean;

  @ApiProperty({ example: false })
  @Expose()
  receiptShowServerName: boolean;

  @ApiProperty({ example: true })
  @Expose()
  receiptShowOrderNumber: boolean;

  @ApiProperty({ example: true })
  @Expose()
  receiptCustomerCopy: boolean;

  @ApiPropertyOptional({ example: '22:00', nullable: true })
  @Expose()
  notificationDoNotDisturbStart: string | null;

  @ApiPropertyOptional({ example: '07:00', nullable: true })
  @Expose()
  notificationDoNotDisturbEnd: string | null;

  @ApiProperty({ example: 0.075, description: 'Tax rate fraction (0.075 = 7.5%)' })
  @Expose()
  taxRate: number;

  @ApiProperty({ example: 'STF', description: 'Prefix for auto-generated staff codes' })
  @Expose()
  staffCodePrefix: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: BusinessSettingsEntity): BusinessSettingsResponseDto {
    return plainToInstance(
      BusinessSettingsResponseDto,
      { ...entity, taxRate: Number(entity.taxRate ?? 0.075) },
      { excludeExtraneousValues: true },
    );
  }
}
