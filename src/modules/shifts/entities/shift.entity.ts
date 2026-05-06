import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreEntity } from '../../store/entities/store.entity';
import { StaffEntity } from '../../staff/entities/staff.entity';
import { RoleEntity } from '../../roles/entities/role.entity';

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

@Entity('shifts')
export class ShiftEntity {
  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  staffId: string;

  @ManyToOne(() => StaffEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: StaffEntity;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ nullable: true })
  roleId: string;

  @ManyToOne(() => RoleEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;

  @ApiProperty({ example: '2026-05-10', description: 'ISO date string (YYYY-MM-DD)' })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({ example: '08:00', description: 'Scheduled start time (HH:MM, 24h)' })
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty({ example: '16:00', description: 'Scheduled end time (HH:MM, 24h)' })
  @Column({ type: 'time' })
  endTime: string;

  @ApiPropertyOptional({ example: 30, nullable: true, description: 'Break duration in minutes' })
  @Column({ type: 'int', nullable: true })
  breakDuration: number;

  @ApiProperty({ enum: ShiftStatus, example: ShiftStatus.SCHEDULED })
  @Column({
    type: 'enum',
    enum: ShiftStatus,
    default: ShiftStatus.SCHEDULED,
  })
  status: ShiftStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'Actual clock-in timestamp' })
  @Column({ type: 'timestamp', nullable: true })
  actualClockIn: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'Actual clock-out timestamp' })
  @Column({ type: 'timestamp', nullable: true })
  actualClockOut: Date;

  @ApiPropertyOptional({ example: 'Cover for sick leave', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  notes: string;

  @ApiPropertyOptional({
    type: 'array',
    nullable: true,
    description: 'Per-shift checklist categories with task completion state',
    items: {
      type: 'object',
      additionalProperties: true,
      example: {
        id: 'opening',
        name: 'Opening Tasks',
        items: [
          { id: '1', task: 'Turn on equipment', completed: false, priority: 'high' },
        ],
      },
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  checklist: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      task: string;
      completed: boolean;
      priority: 'high' | 'medium' | 'low';
      completedAt?: string;
    }>;
  }> | null;

  @ApiPropertyOptional({
    type: 'array',
    nullable: true,
    description: 'Recorded breaks taken during the shift',
    items: {
      type: 'object',
      additionalProperties: true,
      example: {
        id: 'b1',
        type: 'lunch',
        startTime: '2026-05-10T12:00:00Z',
        durationMinutes: 30,
        notes: null,
      },
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  breaks: Array<{
    id: string;
    type: 'lunch' | 'rest' | 'other';
    startTime: string;
    durationMinutes: number;
    notes?: string | null;
  }> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
