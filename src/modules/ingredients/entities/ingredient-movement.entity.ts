import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientEntity } from './ingredient.entity';

export enum MovementType {
  INTAKE = 'intake',
  CONSUMPTION = 'consumption',
  WASTE = 'waste',
  TRANSFER = 'transfer',
  CORRECTION = 'correction',
}

@Entity('ingredient_movements')
@Index(['storeId', 'createdAt'])
export class IngredientMovementEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  ingredientId: string;

  @ManyToOne(() => IngredientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: IngredientEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  staffName: string | null;

  @ApiProperty({ enum: MovementType, example: MovementType.INTAKE })
  @Column({ type: 'enum', enum: MovementType })
  @Index()
  type: MovementType;

  @ApiProperty({ example: 5.0, description: 'Signed delta — positive for additions, negative for consumption/waste' })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  @ApiProperty({ example: 50.0 })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  previousStock: number;

  @ApiProperty({ example: 55.0 })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  newStock: number;

  @ApiPropertyOptional({ nullable: true, example: 'Spoiled during storage' })
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'order' })
  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
