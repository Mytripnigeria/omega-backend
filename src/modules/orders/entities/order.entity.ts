import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderItemEntity } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type OrderChannel = 'pos' | 'website' | 'phone';

@Entity('orders')
@Unique(['storeId', 'orderNumber'])
export class OrderEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 42, description: 'Sequential per-store order number' })
  @Column({ type: 'int' })
  orderNumber: number;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Cashier who placed the order' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  staffId: string | null;

  @ApiPropertyOptional({ example: 'Amaka Okafor', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  staffName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Linked CustomerEntity id' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  customerId: string | null;

  @ApiPropertyOptional({ example: 'John Doe', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @ApiPropertyOptional({ example: 'T-12', nullable: true, description: 'Table number for dine-in orders' })
  @Column({ type: 'varchar', nullable: true })
  tableNumber: string | null;

  @ApiProperty({ enum: ['pos', 'website', 'phone'], example: 'pos' })
  @Column({ type: 'enum', enum: ['pos', 'website', 'phone'], default: 'pos' })
  channel: OrderChannel;

  @ApiProperty({ example: false, description: 'Order is for delivery (vs dine-in/takeout)' })
  @Column({ default: false })
  isDelivery: boolean;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index()
  status: OrderStatus;

  @ApiProperty({ example: 4500 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @ApiProperty({ example: 337.5 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @ApiProperty({ example: 4837.5 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidAmount: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty({ type: () => [OrderItemEntity] })
  @OneToMany(() => OrderItemEntity, (i) => i.order, { cascade: true, eager: false })
  items: OrderItemEntity[];

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
