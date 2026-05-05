import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PrinterType = 'kitchen' | 'receipt' | 'bar' | 'label';
export type PrinterConnection = 'network' | 'usb' | 'bluetooth' | 'cloud';

@Entity('printers')
export class PrinterEntity {
  @ApiProperty({ format: 'uuid', example: 'pr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ example: 'Kitchen Printer 1' })
  @Column()
  name: string;

  @ApiProperty({
    enum: ['kitchen', 'receipt', 'bar', 'label'],
    example: 'kitchen',
    description: 'Determines which print jobs are routed to this printer',
  })
  @Column({
    type: 'enum',
    enum: ['kitchen', 'receipt', 'bar', 'label'],
  })
  type: PrinterType;

  @ApiProperty({
    enum: ['network', 'usb', 'bluetooth', 'cloud'],
    example: 'network',
  })
  @Column({
    type: 'enum',
    enum: ['network', 'usb', 'bluetooth', 'cloud'],
  })
  connection: PrinterConnection;

  @ApiPropertyOptional({ example: '192.168.1.100', nullable: true, description: 'IP address (network), device path (usb), or MAC (bluetooth)' })
  @Column({ nullable: true })
  address: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { paperWidth: 80, dpi: 203, cashDrawer: true },
    description: 'Printer-specific configuration',
  })
  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @ApiProperty({ example: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'Last time the printer sent a heartbeat' })
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
