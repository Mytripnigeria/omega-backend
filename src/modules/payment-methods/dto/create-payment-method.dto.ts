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

export class CreatePaymentMethodDto {
  @IsEnum(['cash', 'card', 'transfer', 'pos', 'mobile_money', 'other'])
  type: 'cash' | 'card' | 'transfer' | 'pos' | 'mobile_money' | 'other';

  @IsString()
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
