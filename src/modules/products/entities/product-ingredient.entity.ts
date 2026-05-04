import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';
import { IngredientEntity } from '../../ingredients/entities/ingredient.entity';

@Entity('product_ingredients')
export class ProductIngredientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @Column()
  ingredientId: string;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  @Column()
  unit: string;

  @ManyToOne(() => ProductEntity, (p) => p.productIngredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @ManyToOne(() => IngredientEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: IngredientEntity;
}
