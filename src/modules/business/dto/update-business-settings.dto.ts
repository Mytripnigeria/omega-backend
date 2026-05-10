import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBusinessSettingsDto {
  @ApiPropertyOptional({ example: 'Thank you for dining with Mr Jollof!', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptHeader?: string;

  @ApiPropertyOptional({ example: 'Please come again. Visit us at mrjollof.com', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string;

  @ApiPropertyOptional({ example: true, description: 'Print the business logo on receipts' })
  @IsOptional()
  @IsBoolean()
  receiptShowLogo?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Print per-item prices on receipts' })
  @IsOptional()
  @IsBoolean()
  receiptShowItemPrices?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Print a tax breakdown line on receipts' })
  @IsOptional()
  @IsBoolean()
  receiptShowTaxBreakdown?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Print the serving staff name on receipts' })
  @IsOptional()
  @IsBoolean()
  receiptShowServerName?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Print the order number on receipts' })
  @IsOptional()
  @IsBoolean()
  receiptShowOrderNumber?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Print a duplicate customer copy of the receipt' })
  @IsOptional()
  @IsBoolean()
  receiptCustomerCopy?: boolean;

  @ApiPropertyOptional({ example: '22:00', nullable: true, description: 'Start of do-not-disturb window in HH:MM (24h). Set to null to disable.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM (24h)' })
  notificationDoNotDisturbStart?: string | null;

  @ApiPropertyOptional({ example: '07:00', nullable: true, description: 'End of do-not-disturb window in HH:MM (24h). Set to null to disable.' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM (24h)' })
  notificationDoNotDisturbEnd?: string | null;

  @ApiPropertyOptional({
    example: 0.075,
    description: 'VAT rate fraction (0.075 = 7.5%). Range 0–1.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;
}
