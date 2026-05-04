import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ComboEntity } from './combo.entity';
import { ProductEntity } from '../../products/entities/product.entity';

@Entity('combo_items')
export class ComboItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  comboId: string;

  @Column()
  productId: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @ManyToOne(() => ComboEntity, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comboId' })
  combo: ComboEntity;

  @ManyToOne(() => ProductEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;
}
