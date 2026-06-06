import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KpiTargetEntity } from './kpi-target.entity';

/** A per-staff progress entry against a KPI target. Used for KPI categories
 *  that aren't auto-computed (customers, efficiency, waste, labor, custom).
 *  Sales/orders categories compute their per-staff numbers live from
 *  OrderEntity at read time. */
@Entity('kpi_performances')
@Unique(['kpiTargetId', 'staffId'])
// Note: the index on kpiTargetId is declared once on the column below
// (@Index()). A duplicate class-level @Index(['kpiTargetId']) was removed —
// it generated a second identical index and broke schema sync.
export class KpiPerformanceEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  kpiTargetId: string;

  @ManyToOne(() => KpiTargetEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpiTargetId' })
  kpiTarget: KpiTargetEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  staffId: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Snapshot of the staff display name at write time.',
  })
  @Column({ type: 'varchar', nullable: true })
  staffName: string | null;

  @ApiProperty({ example: 15000 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  value: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional note (e.g., "completed orders 23-25").',
  })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
