import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type CashSessionStatus = 'open' | 'closed' | 'reviewed';

export type ReconciliationStatus = 'balanced' | 'short' | 'over' | null;

@Entity('cash_sessions')
@Index(['businessId', 'storeId', 'status'])
@Index(['staffId', 'status'])
export class CashSessionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  staffId: string;

  @ApiProperty({ example: 'Amaka Okafor' })
  @Column({ type: 'varchar' })
  staffName: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Linked shift, if any' })
  @Column({ type: 'uuid', nullable: true })
  shiftId: string | null;

  @ApiProperty({ enum: ['open', 'closed', 'reviewed'], default: 'open' })
  @Column({ type: 'enum', enum: ['open', 'closed', 'reviewed'], default: 'open' })
  status: CashSessionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Column({ type: 'timestamptz' })
  openedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ example: 5000 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  openingFloat: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  expectedCash: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  expectedCard: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  expectedMobile: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  expectedTotal: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualCash: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualCard: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualMobile: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualTotal: number;

  @ApiProperty({ example: 0, description: 'actualTotal - expectedTotal' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  difference: number;

  @ApiPropertyOptional({
    enum: ['balanced', 'short', 'over'],
    nullable: true,
  })
  @Column({
    type: 'enum',
    enum: ['balanced', 'short', 'over'],
    nullable: true,
  })
  reconciliationStatus: 'balanced' | 'short' | 'over' | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  reviewedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
