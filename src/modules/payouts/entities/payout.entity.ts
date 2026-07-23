import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PayoutStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled';

@Entity('payouts')
@Unique(['reference'])
@Index(['businessId', 'status'])
export class PayoutEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({
    example: 'PAYOUT_1730000000000_a1b2c3d4',
    description: 'Stable client/provider-facing reference for this payout',
  })
  @Column({ type: 'varchar' })
  reference: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  bankAccountId: string;

  @ApiProperty({ example: 50000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @ApiProperty({ default: 'NGN' })
  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @ApiProperty({
    enum: [
      'pending',
      'queued',
      'processing',
      'success',
      'failed',
      'cancelled',
    ],
    default: 'pending',
  })
  @Column({
    type: 'enum',
    enum: [
      'pending',
      'queued',
      'processing',
      'success',
      'failed',
      'cancelled',
    ],
    default: 'pending',
  })
  status: PayoutStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  providerTransferCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  providerStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  requestedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  requestedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  queuedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  processingAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
