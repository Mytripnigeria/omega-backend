import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from './order.entity';

@Entity('order_status_events')
export class OrderStatusEventEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  fromStatus: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  @Column({ type: 'enum', enum: OrderStatus })
  toStatus: OrderStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ApiPropertyOptional({ enum: ['admin', 'staff', 'user', 'system'], nullable: true })
  @Column({ type: 'varchar', nullable: true })
  actorType: 'admin' | 'staff' | 'user' | 'system' | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
