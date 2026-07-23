import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockTransferItemEntity } from './stock-transfer-item.entity';

export enum StockTransferStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in-transit',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('stock_transfers')
export class StockTransferEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  fromLocationId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  toLocationId: string;

  @ApiProperty({ enum: StockTransferStatus })
  @Column({
    type: 'enum',
    enum: StockTransferStatus,
    default: StockTransferStatus.PENDING,
  })
  status: StockTransferStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  requestedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  requestedByName: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  receivedById: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => StockTransferItemEntity, (i) => i.transfer, {
    cascade: true,
    eager: true,
  })
  items: StockTransferItemEntity[];

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
