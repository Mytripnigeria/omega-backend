import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  Unique,
} from 'typeorm';
import { AddOnEntity } from './addon.entity';

@Entity('addon_groups')
@Unique(['businessId', 'name'])
export class AddOnGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  minSelection: number;

  @Column({ type: 'int', nullable: true })
  maxSelection: number;

  @Column({ default: true })
  status: boolean;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @OneToMany(() => AddOnEntity, (addon) => addon.addOnGroup, {
    cascade: true,
    eager: false,
  })
  addons: AddOnEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
