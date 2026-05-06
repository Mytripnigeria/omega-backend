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

  @ApiProperty({ example: 0, description: 'Total refunded amount across one or more refund events' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  refundedAmount: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    nullable: true,
  })
  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    nullable: true,
  })
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;

  @ApiPropertyOptional({
    enum: ['cash', 'card', 'wallet', 'points', 'paystack'],
    nullable: true,
  })
  @Column({
    type: 'enum',
    enum: ['cash', 'card', 'wallet', 'points', 'paystack'],
    nullable: true,
  })
  paymentChannel: 'cash' | 'card' | 'wallet' | 'points' | 'paystack' | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Paystack transaction reference',
  })
  @Column({ type: 'varchar', nullable: true })
  paymentReference: string | null;

  @ApiPropertyOptional({ example: 1500, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  deliveryFee: number;

  @ApiPropertyOptional({ example: 500, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tipAmount: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  couponCode: string | null;

  @ApiPropertyOptional({ example: 1000, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  couponDiscount: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  deliveryAddressId: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Snapshot of the delivery address at order time',
  })
  @Column({ type: 'jsonb', nullable: true })
  deliveryAddress: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Scheduled time (null = ASAP)',
  })
  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor: Date | null;

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
