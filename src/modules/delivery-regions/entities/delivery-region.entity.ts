import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A named delivery area of a store with its own delivery fee. Replaces the
 * single flat `store.deliveryFee`: the customer (storefront) or cashier (POS)
 * picks the region an order is going to, and that region's fee is what gets
 * charged. `store.deliveryFee` stays as the fallback for stores that have not
 * configured any region yet.
 */
@Entity('delivery_regions')
@Unique('UQ_delivery_region_store_name', ['storeId', 'name'])
export class DeliveryRegionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ example: 'Lekki Phase 1' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiPropertyOptional({ nullable: true, example: 'Includes Admiralty Way and Freedom Way' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: 1500, description: 'Delivery fee charged for this region' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fee: number;

  @ApiProperty({ example: 0, description: 'Minimum order subtotal required to deliver here' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  minOrderAmount: number;

  @ApiPropertyOptional({ nullable: true, example: 45, description: 'Typical delivery time in minutes' })
  @Column({ type: 'int', nullable: true })
  estimatedMinutes: number | null;

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ example: 0, description: 'Display order in the region picker' })
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
