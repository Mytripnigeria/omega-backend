import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string;

  @IsOptional()
  @IsBoolean()
  receiptShowLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  receiptShowItemPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  receiptShowTaxBreakdown?: boolean;

  @IsOptional()
  @IsBoolean()
  receiptShowServerName?: boolean;

  @IsOptional()
  @IsBoolean()
  receiptShowOrderNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  receiptCustomerCopy?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM (24h)' })
  notificationDoNotDisturbStart?: string | null;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Must be HH:MM (24h)' })
  notificationDoNotDisturbEnd?: string | null;
}
