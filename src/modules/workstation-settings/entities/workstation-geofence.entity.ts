import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One place staff may sign in and clock in from.
 *
 * A store used to have exactly one geofence — a single centre and radius on
 * the settings record — which does not describe how these businesses work: a
 * branch has a dining room and a kitchen unit down the road, or a team covers
 * two addresses. The merchant asked for "multiple locations added to each
 * store", so the fences live here, one row per place, and a staff member is
 * inside the fence if they are inside ANY of them.
 */
@Entity('workstation_geofences')
export class WorkstationGeofenceEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Main kitchen', description: 'What staff call this place.' })
  @Column({ type: 'varchar' })
  label: string;

  @ApiProperty({ example: 7.7337 })
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @ApiProperty({ example: 8.5214 })
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @ApiProperty({ example: 150, description: 'How far from the centre still counts, in metres.' })
  @Column({ type: 'int', default: 100 })
  radiusMeters: number;

  @ApiPropertyOptional({ description: 'Turn one place off without deleting it.' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
