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

@Entity('webhooks')
export class WebhookEntity {
  @ApiProperty({ format: 'uuid', example: 'wh1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'https://myapp.com/webhooks/omega' })
  @Column()
  url: string;

  @ApiProperty({
    type: [String],
    example: ['order.created', 'payment.received', 'low_stock.alert'],
    description: 'Event types that trigger this webhook',
  })
  @Column({ type: 'simple-array' })
  events: string[];

  @ApiProperty({ writeOnly: true, description: 'HMAC signing secret — returned only on create and rotate-secret; never on reads' })
  @Column({ select: false })
  secret: string;

  @ApiProperty({ example: 'a1b2', description: 'Last 4 characters of the current signing secret' })
  @Column({ length: 4 })
  secretLastFour: string;

  @ApiProperty({ example: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'When the last event delivery was attempted' })
  @Column({ type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date | null;

  @ApiProperty({ example: 0, description: 'Consecutive delivery failure count; webhook auto-disables at threshold' })
  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
