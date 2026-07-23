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

export enum EquipmentCategory {
  KITCHEN = 'kitchen',
  REFRIGERATION = 'refrigeration',
  POS = 'pos',
  FURNITURE = 'furniture',
  HVAC = 'hvac',
  OTHER = 'other',
}

export enum EquipmentStatus {
  OPERATIONAL = 'operational',
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
  OFFLINE = 'offline',
  RETIRED = 'retired',
}

@Entity('equipment')
export class EquipmentEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ApiProperty({ example: 'Walk-in Freezer A1' })
  @Column()
  name: string;

  @ApiProperty({ enum: EquipmentCategory })
  @Column({ type: 'enum', enum: EquipmentCategory, default: EquipmentCategory.KITCHEN })
  category: EquipmentCategory;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'SN-1234567', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  serialNumber: string | null;

  @ApiPropertyOptional({ example: 'KX-2024', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @ApiPropertyOptional({ example: 'Hoshizaki', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  manufacturer: string | null;

  @ApiPropertyOptional({ example: '2024-06-15', nullable: true })
  @Column({ type: 'date', nullable: true })
  purchaseDate: string | null;

  @ApiPropertyOptional({ example: 850000, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  purchasePrice: number | null;

  @ApiPropertyOptional({ example: '2027-06-15', nullable: true })
  @Column({ type: 'date', nullable: true })
  warrantyExpiry: string | null;

  @ApiProperty({ enum: EquipmentStatus, default: EquipmentStatus.OPERATIONAL })
  @Column({ type: 'enum', enum: EquipmentStatus, default: EquipmentStatus.OPERATIONAL })
  status: EquipmentStatus;

  @ApiPropertyOptional({ example: -18.5, nullable: true, description: 'Latest recorded temperature (denormalized from EquipmentTemperatureReadingEntity).' })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  currentTemperature: number | null;

  @ApiPropertyOptional({ example: -20, nullable: true, description: 'Setpoint / desired temperature' })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  targetTemperature: number | null;

  @ApiPropertyOptional({
    example: -22,
    nullable: true,
    description: 'Lower bound of the safe-temperature range. Readings below this trigger alerts.',
  })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  minTempC: number | null;

  @ApiPropertyOptional({
    example: -15,
    nullable: true,
    description: 'Upper bound of the safe-temperature range. Readings above this trigger alerts.',
  })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxTempC: number | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Timestamp of the most recent temperature reading.',
  })
  @Column({ type: 'timestamptz', nullable: true })
  lastReadingAt: Date | null;

  @ApiPropertyOptional({ example: '2026-04-01', nullable: true })
  @Column({ type: 'date', nullable: true })
  lastMaintenanceDate: string | null;

  @ApiPropertyOptional({ example: '2026-07-01', nullable: true })
  @Column({ type: 'date', nullable: true })
  nextMaintenanceDate: string | null;

  @ApiPropertyOptional({ example: 90, nullable: true })
  @Column({ type: 'int', nullable: true })
  maintenanceCycleDays: number | null;

  @ApiPropertyOptional({ example: 99.5, nullable: true })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  uptime: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
