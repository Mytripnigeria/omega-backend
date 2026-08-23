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

export enum StoreLinkStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
  REVOKED = 'revoked',
}

/**
 * Permission for one store's workstation to help run another store's orders.
 *
 * The case this exists for: a single restaurant unit fulfilling orders for
 * several brands. The *requester* store's workstation gains sight of the
 * *target* store's orders and may move them through the kitchen — nothing else.
 * Menu, stock, staff, reports and settings all stay with the target store, and
 * the link never surfaces in the requester's merchant dashboard.
 *
 * Both sides are recorded because the two stores usually belong to different
 * businesses: the target's owner is the one who approves.
 */
@Entity('store_links')
@Unique(['requesterStoreId', 'targetStoreId'])
export class StoreLinkEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Store asking to help.' })
  @Column({ type: 'uuid' })
  @Index()
  requesterStoreId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  requesterBusinessId: string;

  @ApiProperty({ format: 'uuid', description: 'Store whose orders are shared.' })
  @Column({ type: 'uuid' })
  @Index()
  targetStoreId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  targetBusinessId: string;

  @ApiProperty({ enum: StoreLinkStatus })
  @Column({ type: 'varchar', default: StoreLinkStatus.PENDING })
  @Index()
  status: StoreLinkStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Note shown to the approver.' })
  @Column({ type: 'varchar', nullable: true })
  message: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  requestedByStaffId: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
