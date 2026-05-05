import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTaxRateDto {
  @ApiProperty({ example: 'VAT', maxLength: 80, description: 'Display name for this tax rate (e.g., VAT, Service Charge)' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 7.5, description: 'Tax rate as a percentage (0–100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent: number;

  @ApiPropertyOptional({ example: false, description: 'true = tax is included in the displayed price; false = added on top at checkout' })
  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'true = this rate is automatically applied to all new products' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true, description: 'false = rate is archived and no longer applied' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
