import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SEATED = 'seated',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show',
}

@Entity('reservations')
export class ReservationEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Linked CustomerEntity' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  customerId: string | null;

  @ApiProperty({ example: 'Adebayo Johnson' })
  @Column()
  customerName: string;

  @ApiProperty({ example: '+2348012345678' })
  @Column()
  customerPhone: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  customerEmail: string | null;

  @ApiProperty({ example: 4 })
  @Column({ type: 'int' })
  partySize: number;

  @ApiProperty({ example: '2026-05-10', description: 'ISO date (YYYY-MM-DD)' })
  @Column({ type: 'date' })
  @Index()
  date: string;

  @ApiProperty({ example: '19:00', description: 'HH:MM 24h' })
  @Column({ type: 'time' })
  time: string;

  @ApiPropertyOptional({ example: 120, nullable: true, description: 'Duration in minutes' })
  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @ApiPropertyOptional({ example: 'T5', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  tableNumber: string | null;

  @ApiProperty({ enum: ReservationStatus, default: ReservationStatus.PENDING })
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  @Index()
  status: ReservationStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  specialRequests: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  seatedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date | null;
}
