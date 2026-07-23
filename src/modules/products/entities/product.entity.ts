import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariationEntity } from './product-variation.entity';
import { ProductIngredientEntity } from './product-ingredient.entity';
import { AddOnGroupEntity } from '../../addon-groups/entities/addon-group.entity';

@Entity('products')
@Unique(['storeId', 'name'])
export class ProductEntity {
  @ApiProperty({ format: 'uuid', example: 'p1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Jollof Rice (Large)' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'Smoky party jollof rice with assorted proteins', nullable: true })
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiPropertyOptional({ example: 'JR-LG-001', nullable: true })
  @Column({ nullable: true })
  productCode: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Reference to a category from the categories module (type=menu)' })
  @Column({ nullable: true })
  categoryId: string;

  @ApiProperty({ example: 3500.00, description: 'Cost price' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @ApiProperty({ example: 4500.00, description: 'Customer-facing selling price' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sellingPrice: number;

  @ApiPropertyOptional({ example: 'JR-LG', nullable: true, description: 'Stock-keeping unit code' })
  @Column({ nullable: true })
  sku: string;

  @ApiProperty({ example: 25, description: 'Available stock count' })
  @Column({ type: 'int', default: 0 })
  stock: number;

  @ApiProperty({ example: true, description: '`true` = available for sale' })
  @Column({ default: true })
  status: boolean;

  @ApiPropertyOptional({ example: 'SUP-001', nullable: true })
  @Column({ nullable: true })
  supplierId: string;

  @ApiPropertyOptional({ example: '15 mins', nullable: true, description: 'Estimated preparation time' })
  @Column({ nullable: true })
  prepTime: string;

  @ApiPropertyOptional({ example: 'inclusive', nullable: true })
  @Column({ nullable: true })
  taxOption: string;

  @ApiPropertyOptional({ example: 'none', nullable: true })
  @Column({ nullable: true })
  discountOption: string;

  @ApiPropertyOptional({ type: [String], example: ['pos', 'website'], nullable: true })
  @Column('simple-array', { nullable: true })
  visibility: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/jollof-large.png', nullable: true })
  @Column({ nullable: true })
  imageUrl: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'File ID for the product image' })
  @Column({ type: 'uuid', nullable: true })
  imageFileId: string | null;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @OneToMany(() => ProductVariationEntity, (v) => v.product, {
    cascade: true,
    eager: false,
  })
  variations: ProductVariationEntity[];

  @OneToMany(() => ProductIngredientEntity, (pi) => pi.product, {
    cascade: true,
    eager: false,
  })
  productIngredients: ProductIngredientEntity[];

  @ManyToMany(() => AddOnGroupEntity, { eager: false })
  @JoinTable({
    name: 'product_addon_groups',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'addonGroupId', referencedColumnName: 'id' },
  })
  addonGroups: AddOnGroupEntity[];

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
