import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientEntity } from './ingredient.entity';
import { InventoryLocationEntity } from '../../inventory-locations/entities/inventory-location.entity';

/**
 * Per-location stock for an ingredient. The same ingredient (definition row
 * on `IngredientEntity`) can exist at multiple locations, each with its own
 * `currentStock`, `minStock` threshold, and best-before date. This is the
 * table the stock-transfers service debits/credits when moving inventory.
 *
 * `IngredientEntity.currentStock` / `minStock` remain as denormalized
 * aggregates (sum of all locations) so existing low-stock alerts and order
 * consumption code can keep reading a single number without changing every
 * call site at once. The service writes both sides on every mutation.
 */
@Entity('ingredient_location_stocks')
@Unique(['ingredientId', 'locationId'])
export class IngredientLocationStockEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  ingredientId!: string;

  @ManyToOne(() => IngredientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient!: IngredientEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  locationId!: string;

  @ManyToOne(() => InventoryLocationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: InventoryLocationEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId!: string;

  @ApiProperty({ example: 50.5, description: 'Stock at this specific location.' })
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  currentStock!: number;

  @ApiProperty({ example: 5, description: 'Per-location reorder threshold.' })
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  minStock!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastRestocked!: Date | null;

  @ApiPropertyOptional({ example: '2026-06-12', nullable: true })
  @Column({ type: 'date', nullable: true })
  expiryDate!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
