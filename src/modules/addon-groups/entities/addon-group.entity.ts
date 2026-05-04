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
import { AddOnEntity } from './addon.entity';

@Entity('addon_groups')
@Unique(['storeId', 'name'])
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

  @Column()
  storeId: string;

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
