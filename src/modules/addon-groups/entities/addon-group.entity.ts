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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddOnEntity } from './addon.entity';

@Entity('addon_groups')
// Add-on groups are store-scoped (client spec, sixth feedback) — uniqueness is
// per-store so each branch keeps its own add-on catalogue.
@Unique(['storeId', 'name'])
export class AddOnGroupEntity {
  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Proteins', description: 'Name of the addon group (e.g. Proteins, Extras, Sauces)' })
  @Column()
  name: string;

  @ApiProperty({ example: 0, default: 0, description: 'Minimum number of addons the customer must select (0 = optional)' })
  @Column({ type: 'int', default: 0 })
  minSelection: number;

  @ApiPropertyOptional({ example: 3, nullable: true, description: 'Maximum number of addons the customer can select (null = unlimited)' })
  @Column({ type: 'int', nullable: true })
  maxSelection: number;

  @ApiProperty({ example: true, description: '`true` = group is visible and selectable' })
  @Column({ default: true })
  status: boolean;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid', description: 'Store this add-on group belongs to' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  storeId: string | null;

  @ApiProperty({ type: () => [AddOnEntity] })
  @OneToMany(() => AddOnEntity, (addon) => addon.addOnGroup, {
    cascade: true,
    eager: false,
  })
  addons: AddOnEntity[];

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
