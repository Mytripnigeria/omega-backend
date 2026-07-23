import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InventoryLocationType {
  INSTORE = 'instore',
  OUTSTORE = 'outstore',
  WAREHOUSE = 'warehouse',
  KITCHEN = 'kitchen',
  BAR = 'bar',
}

@Entity('inventory_locations')
@Unique(['storeId', 'name'])
export class InventoryLocationEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ example: 'Main Kitchen Storage' })
  @Column()
  name: string;

  @ApiProperty({ enum: InventoryLocationType })
  @Column({ type: 'enum', enum: InventoryLocationType, default: InventoryLocationType.INSTORE })
  type: InventoryLocationType;

  @ApiPropertyOptional({ example: 'Behind the kitchen prep area', nullable: true })
  @Column({ type: 'text', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: false })
  @Column({ default: false })
  isDefault: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
