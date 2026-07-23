import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AddOnEntity } from './addon.entity';
import { IngredientEntity } from '../../ingredients/entities/ingredient.entity';

/**
 * Recipe line for an add-on option — the add-on equivalent of
 * ProductIngredientEntity. Lets "Extra Chicken" actually deduct chicken from
 * stock when a customer picks it, instead of being a price-only modifier.
 */
@Entity('addon_ingredients')
export class AddonIngredientEntity {
  @ApiProperty({ format: 'uuid', example: 'ai1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'ao1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  addOnId: string;

  @ApiProperty({ format: 'uuid', example: 'ing1a2b3-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  ingredientId: string;

  @ApiProperty({ example: 0.25, description: 'Quantity consumed each time this add-on is selected' })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unit of measure' })
  @Column()
  unit: string;

  @ManyToOne(() => AddOnEntity, (a) => a.addonIngredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'addOnId' })
  addOn: AddOnEntity;

  @ManyToOne(() => IngredientEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: IngredientEntity;
}
