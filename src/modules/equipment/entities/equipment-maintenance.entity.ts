import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MaintenanceType {
  ROUTINE = 'routine',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  CLEANING = 'cleaning',
}

@Entity('equipment_maintenance_logs')
export class EquipmentMaintenanceEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  equipmentId: string;

  @ApiProperty({ enum: MaintenanceType })
  @Column({ type: 'enum', enum: MaintenanceType, default: MaintenanceType.ROUTINE })
  type: MaintenanceType;

  @ApiProperty({ example: '2026-04-01' })
  @Column({ type: 'date' })
  performedOn: string;

  @ApiPropertyOptional({ example: 'Mike Johnson', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  performedBy: string | null;

  @ApiPropertyOptional({ example: 12500, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  cost: number | null;

  @ApiProperty({ example: 'Replaced compressor and refilled refrigerant' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
