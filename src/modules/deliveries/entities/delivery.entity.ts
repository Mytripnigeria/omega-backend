import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderEntity } from '../../orders/entities/order.entity';

export enum DeliveryStatus {
  /**
   * Created but not yet handed off by the waiter ("Send for delivery").
   * Invisible to riders — the Delivery board only lists PENDING onwards.
   */
  AWAITING_DISPATCH = 'awaiting_dispatch',
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('deliveries')
export class DeliveryEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', unique: true })
  @Index()
  orderId: string;

  @OneToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Staff member with rider role' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  riderStaffId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Amaka Eze' })
  @Column({ type: 'varchar', nullable: true })
  riderName: string | null;

  @ApiProperty({ example: '14 Adeola Odeku St, Victoria Island, Lagos' })
  @Column({ type: 'text' })
  address: string;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 6.4281, nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @ApiPropertyOptional({ example: 3.4219, nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.PENDING })
  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  @Index()
  status: DeliveryStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the waiter sent the order out to the delivery board.',
  })
  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  dispatchedByStaffId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Jenifer Okpe' })
  @Column({ type: 'varchar', nullable: true })
  dispatchedByName: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  pickedUpAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

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
