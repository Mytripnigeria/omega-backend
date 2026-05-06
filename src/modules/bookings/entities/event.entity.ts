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

export enum EventType {
  PRIVATE = 'private',
  CORPORATE = 'corporate',
  WEDDING = 'wedding',
  BIRTHDAY = 'birthday',
  HOLIDAY = 'holiday',
  OTHER = 'other',
}

export enum EventStatus {
  INQUIRY = 'inquiry',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('events')
export class EventEntity {
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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  customerId: string | null;

  @ApiProperty({ example: 'Corporate Dinner — TechCorp' })
  @Column()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ enum: EventType })
  @Column({ type: 'enum', enum: EventType, default: EventType.PRIVATE })
  type: EventType;

  @ApiProperty({ example: '2026-05-25' })
  @Column({ type: 'date' })
  @Index()
  date: string;

  @ApiProperty({ example: '18:00' })
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty({ example: '22:00' })
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty({ example: 50 })
  @Column({ type: 'int' })
  expectedGuests: number;

  @ApiPropertyOptional({ example: 45, nullable: true })
  @Column({ type: 'int', nullable: true })
  confirmedGuests: number | null;

  @ApiProperty({ enum: EventStatus, default: EventStatus.INQUIRY })
  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.INQUIRY,
  })
  @Index()
  status: EventStatus;

  @ApiProperty({ example: 'Sarah Okafor' })
  @Column()
  contactName: string;

  @ApiProperty({ example: '+2348011112222' })
  @Column()
  contactPhone: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  contactEmail: string | null;

  @ApiPropertyOptional({ example: 'Main Hall', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  venueArea: string | null;

  @ApiPropertyOptional({ example: 100000, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  deposit: number | null;

  @ApiProperty({ example: false })
  @Column({ default: false })
  depositPaid: boolean;

  @ApiPropertyOptional({ example: 500000, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  totalAmount: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidAmount: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

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
