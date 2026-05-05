import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  PrinterConnection,
  PrinterEntity,
  PrinterType,
} from '../entities/printer.entity';

export class PrinterResponseDto {
  @ApiProperty({ format: 'uuid', example: 'pr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiProperty({ example: 'Kitchen Printer 1' })
  @Expose()
  name: string;

  @ApiProperty({ enum: ['kitchen', 'receipt', 'bar', 'label'], example: 'kitchen' })
  @Expose()
  type: PrinterType;

  @ApiProperty({ enum: ['network', 'usb', 'bluetooth', 'cloud'], example: 'network' })
  @Expose()
  connection: PrinterConnection;

  @ApiPropertyOptional({ example: '192.168.1.100', nullable: true })
  @Expose()
  address: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { paperWidth: 80, dpi: 203, cashDrawer: true },
  })
  @Expose()
  config: Record<string, unknown> | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastSeenAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: PrinterEntity): PrinterResponseDto {
    return plainToInstance(PrinterResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: PrinterEntity[]): PrinterResponseDto[] {
    return entities.map((e) => PrinterResponseDto.from(e));
  }
}
