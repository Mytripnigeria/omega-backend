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

export enum ChecklistAssignmentType {
  /** Visible to every staff member in the store. */
  ALL_STAFF = 'all_staff',
  /** Assigned to a specific role; visible to all staff in that role. */
  ROLE = 'role',
  /** Assigned to one staff member by id. */
  STAFF = 'staff',
}

export enum ChecklistFrequency {
  /** Runs once at the configured due date/time and disappears after completion. */
  ONE_OFF = 'one_off',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum ChecklistStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  order: number;
}

@Entity('checklists')
@Index(['businessId', 'storeId'])
export class ChecklistEntity {
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

  @ApiProperty({ example: 'Opening Checklist' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ enum: ChecklistAssignmentType })
  @Column({ type: 'enum', enum: ChecklistAssignmentType })
  assignmentType: ChecklistAssignmentType;

  /** When assignmentType=role: a roleId. When assignmentType=staff: a staffId.
   *  Null for ALL_STAFF. */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Denormalized label used for display ("All Staff", role name, or staff full name).',
  })
  @Column({ type: 'varchar', nullable: true })
  assignedToName: string | null;

  @ApiProperty({ enum: ChecklistFrequency })
  @Column({ type: 'enum', enum: ChecklistFrequency })
  frequency: ChecklistFrequency;

  @ApiPropertyOptional({
    example: '08:00',
    nullable: true,
    description: 'HH:MM (24-hour) — the time of day this checklist is due.',
  })
  @Column({ type: 'varchar', length: 5, nullable: true })
  dueTime: string | null;

  @ApiPropertyOptional({
    example: '2026-06-15',
    nullable: true,
    description:
      'Calendar date the checklist is anchored to. Required for one-off; for recurring checklists, this is the starting date.',
  })
  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @ApiProperty({ enum: ChecklistStatus, default: ChecklistStatus.PENDING })
  @Column({
    type: 'enum',
    enum: ChecklistStatus,
    default: ChecklistStatus.PENDING,
  })
  status: ChecklistStatus;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'Ordered checklist items. Completion state lives on the item (isCompleted/completedBy/completedAt) so it survives reads.',
  })
  @Column({ type: 'jsonb', default: [] })
  items: ChecklistItem[];

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
