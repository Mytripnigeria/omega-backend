import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrinterEntity } from './printer.entity';

export type PrintJobType = 'test' | 'receipt' | 'kitchen' | 'bar' | 'label';
export type PrintJobStatus = 'queued' | 'sent' | 'failed';

/**
 * One row per attempted print. For a "test" job we attempt best-effort
 * ESC/POS delivery synchronously on the request thread; for real print jobs
 * a future worker can pull `queued` rows and retry/escalate. Either way we
 * always have an auditable record of what was sent and whether it succeeded.
 */
@Entity('print_jobs')
export class PrintJobEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  printerId: string;

  @ManyToOne(() => PrinterEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'printerId' })
  printer: PrinterEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ enum: ['test', 'receipt', 'kitchen', 'bar', 'label'] })
  @Column({ type: 'enum', enum: ['test', 'receipt', 'kitchen', 'bar', 'label'] })
  type: PrintJobType;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Job-type specific payload (e.g. orderId for "receipt", text for "test"). Storing it lets us re-emit later without re-deriving the source data.',
  })
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @ApiProperty({ enum: ['queued', 'sent', 'failed'], default: 'queued' })
  @Column({ type: 'enum', enum: ['queued', 'sent', 'failed'], default: 'queued' })
  status: PrintJobStatus;

  @ApiProperty({ example: 1, description: 'Number of delivery attempts.' })
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
