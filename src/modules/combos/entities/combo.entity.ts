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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComboItemEntity } from './combo-item.entity';

@Entity('combos')
@Unique(['storeId', 'name'])
export class ComboEntity {
  @ApiProperty({ format: 'uuid', example: 'cb1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Family Jollof Combo' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'Feeds 4 — includes rice, chicken, plantain, and drinks', nullable: true })
  @Column({ nullable: true, type: 'text' })
  description: string;

  @ApiProperty({ example: 12000.00, description: 'Discounted combo selling price' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @ApiProperty({ example: 15500.00, description: 'Sum of individual item prices (before combo discount)' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  originalPrice: number;

  @ApiProperty({ example: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/combos/family.png', nullable: true })
  @Column({ nullable: true })
  imageUrl: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  imageFileId: string | null;

  @ApiProperty({ example: 47, description: 'Total number of times this combo has been sold' })
  @Column({ type: 'int', default: 0 })
  sales: number;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @OneToMany(() => ComboItemEntity, (item) => item.combo, {
    cascade: true,
    eager: false,
  })
  items: ComboItemEntity[];

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
