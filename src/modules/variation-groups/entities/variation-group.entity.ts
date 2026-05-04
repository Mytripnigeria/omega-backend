import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { VariationOptionEntity } from './variation-option.entity';

@Entity('variation_groups')
@Unique(['storeId', 'name'])
export class VariationGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  storeId: string;

  @OneToMany(() => VariationOptionEntity, (opt) => opt.variationGroup, {
    cascade: true,
    eager: false,
  })
  options: VariationOptionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
