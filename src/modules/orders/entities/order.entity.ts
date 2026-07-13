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
  /**
   * Brand-new order from any channel (storefront, self-order, counter POS).
   * Waits in the counter POS until a cashier Accepts it (-> PENDING) or
   * Rejects it (-> CANCELLED). Auto-accept can transition it immediately.
   */
  INITIATED = 'initiated',
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  /**
   * Delivery orders only: a rider has collected the order and is en route.
   * Reached from READY once a rider self-assigns and the waiter marks served.
   */
  DELIVERING = 'delivering',
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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'TableEntity id (when the order is opened against a managed table).',
  })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  tableId: string | null;

  @ApiPropertyOptional({
    example: 'T-12',
    nullable: true,
    description:
      'Denormalised table label at order time. Snapshotted from the table for receipts/reports so renaming a table later does not retroactively change historical orders.',
  })
  @Column({ type: 'varchar', nullable: true })
  tableNumber: string | null;

  @ApiProperty({ enum: ['pos', 'website', 'phone'], example: 'pos' })
  @Column({ type: 'enum', enum: ['pos', 'website', 'phone'], default: 'pos' })
  channel: OrderChannel;

  @ApiProperty({ example: false, description: 'Order is for delivery (vs dine-in/takeout)' })
  @Column({ default: false })
  isDelivery: boolean;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.INITIATED })
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.INITIATED })
  @Index()
  status: OrderStatus;

  @ApiPropertyOptional({
    nullable: true,
    example: 20,
    description:
      'Estimated preparation time in minutes for the whole order — the prep ' +
      'time of the item with the longest prep time. Computed at create.',
  })
  @Column({ type: 'int', nullable: true })
  estimatedPrepMinutes: number | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'When the order entered PREPARING. The kitchen countdown anchors on ' +
      'this so it only starts ticking once prep actually begins.',
  })
  @Column({ type: 'timestamptz', nullable: true })
  preparingStartedAt: Date | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Staff member who moved the order into PREPARING.',
  })
  @Column({ type: 'uuid', nullable: true })
  preparingStaffId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Jenifer Okpe',
    description: 'Display name of whoever moved the order into PREPARING.',
  })
  @Column({ type: 'varchar', nullable: true })
  preparingStaffName: string | null;

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

  @ApiProperty({
    example: 0,
    description: 'Loyalty points redeemed at checkout — used to refund on cancellation.',
  })
  @Column({ type: 'int', default: 0 })
  pointsRedeemed: number;

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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Redemption row id — used to release the coupon on cancellation.',
  })
  @Column({ type: 'uuid', nullable: true })
  couponRedemptionId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  couponId: string | null;

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
