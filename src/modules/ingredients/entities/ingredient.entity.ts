import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';

@Entity('ingredients')
@Unique(['storeId', 'name'])
export class IngredientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  unit: string;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  currentStock: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  minStock: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  costPerUnit: number;

  @Column({ nullable: true })
  supplierId: string;

  @Column({ nullable: true })
  sku: string;

  @Column()
  storeId: string;

  @Column({ nullable: true, type: 'timestamp' })
  lastRestocked: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
