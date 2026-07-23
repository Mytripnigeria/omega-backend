import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('ingredients')
@Unique(['storeId', 'name'])
export class IngredientEntity {
  @ApiProperty({ format: 'uuid', example: 'i1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  @Column()
  name: string;

  @ApiProperty({ example: 'kg', description: 'Unit of measure (e.g. kg, litres, pieces)' })
  @Column()
  unit: string;

  @ApiProperty({ example: 50.500, description: 'Current stock level in the specified unit' })
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  currentStock: number;

  @ApiProperty({ example: 10.000, description: 'Minimum stock level — alert threshold' })
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  minStock: number;

  @ApiProperty({ example: 1200.00, description: 'Cost per unit in the business currency' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  costPerUnit: number;

  @ApiPropertyOptional({
    example: 'SUP-002',
    nullable: true,
    deprecated: true,
    description: 'Legacy single-supplier reference. Use `supplierIds` instead; this is kept for backward compatibility and mirrors `supplierIds[0]` on write.',
  })
  @Column({ type: 'varchar', nullable: true })
  supplierId!: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['sup1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21'],
    description: 'List of supplier UUIDs that supply this ingredient. Multi-select on the merchant hub form.',
  })
  @Column({ type: 'simple-array', nullable: true })
  supplierIds!: string[] | null;

  @ApiPropertyOptional({ example: 'RI-LG-001', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  sku!: string | null;

  @ApiPropertyOptional({
    example: 'ingredient',
    nullable: true,
    description:
      'Inventory variant/type — e.g. ingredient, packaging, premix, hygiene. ' +
      'All ingredients are inventories but not all inventories are ingredients.',
  })
  @Column({ type: 'varchar', nullable: true, default: 'ingredient' })
  type!: string | null;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'When stock was last replenished' })
  @Column({ nullable: true, type: 'timestamptz' })
  lastRestocked!: Date | null;

  @ApiPropertyOptional({
    example: '2026-06-12',
    nullable: true,
    description: 'Best-before / use-by date for the current stock batch. Refreshed when new stock is received via adjust-stock.',
  })
  @Column({ type: 'date', nullable: true })
  expiryDate: string | null;

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
