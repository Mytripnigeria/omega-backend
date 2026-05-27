import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentEntity } from './equipment.entity';

/**
 * Append-only history of temperature readings for an equipment item.
 * The latest reading is also denormalized onto `EquipmentEntity.currentTemperature`
 * + `lastReadingAt` so the workstation Inventory Alerts card can read a single
 * "status" endpoint without aggregating history every refresh.
 */
@Entity('equipment_temperature_readings')
export class EquipmentTemperatureReadingEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  equipmentId: string;

  @ManyToOne(() => EquipmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipmentId' })
  equipment: EquipmentEntity;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ example: -18.4, description: 'Temperature reading in degrees Celsius.' })
  @Column({ type: 'decimal', precision: 6, scale: 2 })
  temperatureC: number;

  @ApiProperty({
    example: true,
    description:
      "True when the reading falls within equipment.minTempC..maxTempC. " +
      "Computed at write-time so historical rows reflect the range that was in force at the time.",
  })
  @Column({ default: true })
  isInRange: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  recordedById: string | null;

  @ApiPropertyOptional({ example: 'Amaka Osei', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  recordedByName: string | null;

  @ApiPropertyOptional({ example: 'Door left open during rush', nullable: true })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt: Date;
}
