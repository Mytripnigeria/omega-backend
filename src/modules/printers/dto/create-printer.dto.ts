import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePrinterDto {
  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this printer belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 'Kitchen Printer 1', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: ['kitchen', 'receipt', 'bar', 'label'], example: 'kitchen', description: 'Printer role — determines which tickets are routed to it' })
  @IsEnum(['kitchen', 'receipt', 'bar', 'label'])
  type: 'kitchen' | 'receipt' | 'bar' | 'label';

  @ApiProperty({ enum: ['network', 'usb', 'bluetooth', 'cloud'], example: 'network', description: 'Physical connection type' })
  @IsEnum(['network', 'usb', 'bluetooth', 'cloud'])
  connection: 'network' | 'usb' | 'bluetooth' | 'cloud';

  @ApiPropertyOptional({ example: '192.168.1.50:9100', maxLength: 120, description: 'IP:port for network printers, or device path for USB' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { paperWidth: 80, beepOnPrint: true },
    description: 'Printer-specific configuration options',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true, description: 'Whether this printer is currently enabled for ticket routing' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
