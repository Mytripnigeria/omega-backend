import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum CategoryType {
  MENU = 'menu',
  INVENTORY = 'inventory',
  EXPENSE = 'expense',
  EQUIPMENT = 'equipment',
}

@Entity('categories')
@Unique(['businessId', 'type', 'name'])
@Index(['businessId', 'type'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: CategoryType, default: CategoryType.MENU })
  type: CategoryType;

  @Column({ nullable: true })
  emoji: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'uuid', nullable: true })
  imageFileId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column('simple-array', { nullable: true })
  visibility: string[];

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
