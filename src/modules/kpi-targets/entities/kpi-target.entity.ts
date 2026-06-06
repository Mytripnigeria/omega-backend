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

export enum KpiCategory {
  SALES = 'sales',
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  EFFICIENCY = 'efficiency',
  WASTE = 'waste',
  LABOR = 'labor',
  CUSTOM = 'custom',
}

export enum KpiAssignmentType {
  ALL_STAFF = 'all_staff',
  ROLE = 'role',
  STAFF = 'staff',
}

export enum KpiPeriod {
  ONE_OFF = 'one_off',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum KpiStatus {
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  BEHIND = 'behind',
  ACHIEVED = 'achieved',
  EXCEEDED = 'exceeded',
}

@Entity('kpi_targets')
@Index(['businessId', 'storeId'])
export class KpiTargetEntity {
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

  @ApiProperty({ example: 'Revenue Target' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ enum: KpiCategory })
  @Column({ type: 'enum', enum: KpiCategory, default: KpiCategory.CUSTOM })
  category: KpiCategory;

  @ApiProperty({ enum: KpiAssignmentType })
  @Column({ type: 'enum', enum: KpiAssignmentType })
  assignmentType: KpiAssignmentType;

  /** roleId when assignmentType=role, staffId when assignmentType=staff,
   *  null for all_staff. */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Display label.' })
  @Column({ type: 'varchar', nullable: true })
  assignedToName: string | null;

  @ApiProperty({ enum: KpiPeriod })
  @Column({ type: 'enum', enum: KpiPeriod })
  period: KpiPeriod;

  @ApiProperty({ example: 100000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  targetValue: number;

  /** Aggregate progress (sum across all contributing staff). For sales/orders
   *  categories this is recomputed on read from OrderEntity; for the rest
   *  it's the sum of manual KpiPerformanceEntity rows. */
  @ApiProperty({ example: 75000 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentValue: number;

  @ApiProperty({ example: '₦' })
  @Column({ type: 'varchar', default: '' })
  unit: string;

  @ApiPropertyOptional({ example: '2026-06-01', nullable: true })
  @Column({ type: 'date', nullable: true })
  periodStart: string | null;

  @ApiPropertyOptional({ example: '2026-06-30', nullable: true })
  @Column({ type: 'date', nullable: true })
  periodEnd: string | null;

  @ApiProperty({ enum: KpiStatus, default: KpiStatus.ON_TRACK })
  @Column({ type: 'enum', enum: KpiStatus, default: KpiStatus.ON_TRACK })
  status: KpiStatus;

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
