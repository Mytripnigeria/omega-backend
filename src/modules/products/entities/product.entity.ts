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
import { ProductVariationEntity } from './product-variation.entity';
import { ProductIngredientEntity } from './product-ingredient.entity';
import { AddOnGroupEntity } from '../../addon-groups/entities/addon-group.entity';

@Entity('products')
@Unique(['storeId', 'name'])
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  productCode: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ nullable: true })
  sku: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ nullable: true })
  prepTime: string;

  @Column({ nullable: true })
  taxOption: string;

  @Column({ nullable: true })
  discountOption: string;

  @Column('simple-array', { nullable: true })
  visibility: string[];

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'uuid', nullable: true })
  imageFileId: string | null;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
