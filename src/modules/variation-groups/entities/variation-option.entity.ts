import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { VariationGroupEntity } from './variation-group.entity';

@Entity('variation_options')
export class VariationOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  variationGroupId: string;

  @ManyToOne(() => VariationGroupEntity, (g) => g.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variationGroupId' })
  variationGroup: VariationGroupEntity;

  @CreateDateColumn()
  createdAt: Date;
}
