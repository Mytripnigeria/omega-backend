import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductEntity } from './product.entity';

@Entity('product_variations')
export class ProductVariationEntity {
  @ApiProperty({ format: 'uuid', example: 'v1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'p1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  productId: string;

  @ApiProperty({ example: 'Large' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'JR-LG', nullable: true })
  @Column({ nullable: true })
  sku: string;

  @ApiProperty({ example: 3500.00, description: 'Cost price for this variation' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @ApiProperty({ example: 4500.00, description: 'Selling price for this variation' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sellingPrice: number;

  @ApiProperty({ example: 20 })
  @Column({ type: 'int', default: 0 })
  stock: number;

  @ManyToOne(() => ProductEntity, (p) => p.variations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
