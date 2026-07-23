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

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  CLEANING = 'cleaning',
}

/**
 * Physical dining table tracked per store. `name` is the human label staff use
 * (e.g. "T-12", "Patio 3"). `tableNumber` on OrderEntity carries the same label
 * as a denormalised snapshot so historical orders survive a table rename or
 * delete.
 */
@Entity('tables')
@Unique(['storeId', 'name'])
export class TableEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId!: string;

  @ApiProperty({ example: 'T-12' })
  @Column()
  name!: string;

  @ApiPropertyOptional({ example: 'Patio', nullable: true, description: 'Floor section / area label.' })
  @Column({ type: 'varchar', nullable: true })
  section!: string | null;

  @ApiProperty({ example: 4, description: 'Maximum number of guests.' })
  @Column({ type: 'int', default: 2 })
  capacity!: number;

  @ApiProperty({ enum: TableStatus, default: TableStatus.AVAILABLE })
  @Column({ type: 'enum', enum: TableStatus, default: TableStatus.AVAILABLE })
  @Index()
  status!: TableStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Optional X coordinate on a floor map (future use).' })
  @Column({ type: 'int', nullable: true })
  positionX!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Optional Y coordinate on a floor map (future use).' })
  @Column({ type: 'int', nullable: true })
  positionY!: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
