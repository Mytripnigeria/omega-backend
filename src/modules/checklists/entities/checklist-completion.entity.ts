import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One staff member's completion of one checklist item for one recurrence
 * period. A row existing = that item is done by that staff for that period;
 * toggling off deletes the row. The `periodKey` (derived from the checklist's
 * frequency + the date) is what makes recurring checklists "recreate" each
 * period — a new period has no rows, so the checklist appears fresh, without a
 * scheduled job. It also powers the merchant's per-assignee performance view.
 */
@Entity('checklist_completions')
@Unique(['checklistId', 'staffId', 'itemId', 'periodKey'])
@Index(['checklistId', 'periodKey'])
export class ChecklistCompletionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  checklistId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  staffId: string;

  @ApiProperty({ example: 'Amaka Okafor' })
  @Column({ type: 'varchar', nullable: true })
  staffName: string | null;

  @ApiProperty({ description: 'The checklist item id (matches ChecklistItem.id).' })
  @Column({ type: 'varchar' })
  itemId: string;

  @ApiProperty({
    example: '2026-06-30',
    description:
      'Recurrence period key derived from the checklist frequency (e.g. a date ' +
      'for daily, "once" for one-off).',
  })
  @Column({ type: 'varchar' })
  periodKey: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Column({ type: 'timestamptz' })
  completedAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
