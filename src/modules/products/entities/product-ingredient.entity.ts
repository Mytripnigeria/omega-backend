import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ProductEntity } from './product.entity';
import { IngredientEntity } from '../../ingredients/entities/ingredient.entity';

@Entity('product_ingredients')
export class ProductIngredientEntity {
  @ApiProperty({ format: 'uuid', example: 'pi1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'pr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  productId: string;

  @ApiProperty({ format: 'uuid', example: 'ing1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  ingredientId: string;

  @ApiProperty({ example: 0.5, description: 'Quantity consumed per unit of the product sold' })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unit of measure' })
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
