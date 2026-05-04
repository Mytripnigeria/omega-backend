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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Mains' })
  @Column()
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.MENU })
  @Column({ type: 'enum', enum: CategoryType, default: CategoryType.MENU })
  type: CategoryType;

  @ApiPropertyOptional({ example: '🍽️' })
  @Column({ nullable: true })
  emoji: string;

  @ApiPropertyOptional({ example: 'Hearty mains served with sides' })
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cat-mains.png' })
  @Column({ nullable: true })
  imageUrl: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  imageFileId: string | null;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ example: 0, default: 0 })
  @Column({ type: 'int', default: 0 })
  order: number;

  @ApiPropertyOptional({ example: ['pos', 'website'], type: [String] })
  @Column('simple-array', { nullable: true })
  visibility: string[];

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
