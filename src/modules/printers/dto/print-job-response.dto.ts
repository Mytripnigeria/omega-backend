import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  PrintJobEntity,
  PrintJobStatus,
  PrintJobType,
} from '../entities/print-job.entity';

export class PrintJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  printerId: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  storeId: string;

  @ApiProperty({ enum: ['test', 'receipt', 'kitchen', 'bar', 'label'] })
  @Expose()
  type: PrintJobType;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @Expose()
  payload: Record<string, unknown> | null;

  @ApiProperty({ enum: ['queued', 'sent', 'failed'] })
  @Expose()
  status: PrintJobStatus;

  @ApiProperty({ example: 1 })
  @Expose()
  attempts: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lastError: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  sentAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: PrintJobEntity): PrintJobResponseDto {
    return plainToInstance(PrintJobResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: PrintJobEntity[]): PrintJobResponseDto[] {
    return entities.map((e) => PrintJobResponseDto.from(e));
  }
}
