import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentMethodDto {
  @ApiProperty({
    enum: ['cash', 'card', 'transfer', 'pos', 'mobile_money', 'other'],
    example: 'transfer',
    description: 'Payment method type',
  })
  @IsEnum(['cash', 'card', 'transfer', 'pos', 'mobile_money', 'other'])
  type: 'cash' | 'card' | 'transfer' | 'pos' | 'mobile_money' | 'other';

  @ApiProperty({ example: 'Bank Transfer', maxLength: 80, description: 'Display label shown on the POS payment screen' })
  @IsString()
  @MaxLength(80)
  label: string;

  @ApiPropertyOptional({ example: true, description: 'Whether this payment method is currently enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { accountNumber: '0012345678', bankCode: '058', bankName: 'GTBank' },
    description: 'Method-specific configuration (bank details, POS terminal ID, etc.)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 1, description: 'Display order on the POS payment screen (0 = first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
