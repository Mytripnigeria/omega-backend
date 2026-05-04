import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AddOnGroupEntity } from './addon-group.entity';

@Entity('addons')
export class AddOnEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @Column({ default: true })
  isAvailable: boolean;

  @Column()
  addOnGroupId: string;

  @ManyToOne(() => AddOnGroupEntity, (g) => g.addons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addOnGroupId' })
  addOnGroup: AddOnGroupEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
