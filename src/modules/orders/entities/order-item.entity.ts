import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderEntity } from './order.entity';

export type PrepStatus = 'pending' | 'preparing' | 'ready';

@Entity('order_items')
export class OrderItemEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @ManyToOne(() => OrderEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  comboId: string | null;

  @ApiProperty({ example: 'Jollof Rice (Large)', description: 'Snapshot of product/combo name at order time' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({ example: 1 })
  @Column({ type: 'int', default: 1 })
  quantity: number;

  @ApiProperty({ example: 4500 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: number;

  @ApiProperty({ example: 4500 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { variationGroupId: 'vg1', optionId: 'o2', name: 'Large' },
  })
  @Column({ type: 'jsonb', nullable: true })
  variation: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'array',
    nullable: true,
    items: {
      type: 'object',
      additionalProperties: true,
      example: { addonId: 'a1', name: 'Extra Chicken', price: 500 },
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  addons: Record<string, unknown>[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty({ enum: ['pending', 'preparing', 'ready'], example: 'pending' })
  @Column({ type: 'enum', enum: ['pending', 'preparing', 'ready'], default: 'pending' })
  prepStatus: PrepStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
