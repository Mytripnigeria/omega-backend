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

/**
 * A Cloove workspace a store sells through.
 *
 * Mirrors the Chowdeck channel model deliberately: a store may hold several
 * Cloove channels, so the natural key is the API key's workspace within the
 * store rather than the store alone.
 */
@Entity('clove_integrations')
@Unique(['storeId', 'cloveStoreId'])
export class CloveIntegrationEntity {
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

  @ApiPropertyOptional({ nullable: true, example: 'Scoops x Mr. Jollof' })
  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Cloove's own store id, when the workspace has more than one. Blank " +
      'means the workspace default.',
  })
  @Column({ type: 'varchar', nullable: true })
  cloveStoreId: string | null;

  @ApiProperty({
    writeOnly: true,
    description: 'Cloove API key. Never returned raw — only masked.',
  })
  @Column({ type: 'varchar', select: false })
  apiKey: string;

  @ApiProperty({ example: 'https://api.clooveai.com' })
  @Column({ type: 'varchar', default: 'https://api.clooveai.com' })
  baseUrl: string;

  @ApiProperty({ example: false })
  @Column({ default: false })
  isEnabled: boolean;

  @ApiProperty({
    example: false,
    description:
      'Auto-accept pulled Cloove orders instead of parking them in the POS.',
  })
  @Column({ default: false })
  autoAccept: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastMenuSyncAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastOrderSyncAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'The oldest order the pull saw but did not register — awaiting payment ' +
      'on Cloove, or an ingest that failed. The pull window is held open back ' +
      'to it, so an order paid long after it was placed is still picked up. ' +
      'Null when nothing is outstanding.',
  })
  @Column({ type: 'timestamptz', nullable: true })
  oldestUnsettledOrderAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
