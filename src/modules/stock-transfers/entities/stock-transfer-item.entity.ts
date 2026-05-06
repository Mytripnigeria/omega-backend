import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockTransferEntity } from './stock-transfer.entity';

@Entity('stock_transfer_items')
export class StockTransferItemEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  transferId: string;

  @ManyToOne(() => StockTransferEntity, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transferId' })
  transfer: StockTransferEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  ingredientId: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  @Column()
  name: string;

  @ApiProperty({ example: 'kg' })
  @Column()
  unit: string;

  @ApiProperty({ example: 25 })
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  @ApiPropertyOptional({ example: 25, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 3, nullable: true })
  receivedQuantity: number | null;

  @ApiProperty({ example: 1200 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitCost: number;
}
