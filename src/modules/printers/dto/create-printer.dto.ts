import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePrinterDto {
  @IsUUID()
  storeId: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsEnum(['kitchen', 'receipt', 'bar', 'label'])
  type: 'kitchen' | 'receipt' | 'bar' | 'label';

  @IsEnum(['network', 'usb', 'bluetooth', 'cloud'])
  connection: 'network' | 'usb' | 'bluetooth' | 'cloud';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
