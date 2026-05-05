import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface DayHours {
  open: string;  // 'HH:MM'
  close: string; // 'HH:MM'
  closed: boolean;
}

export type WeeklyHours = {
  [day in 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday']: DayHours;
};

@Entity('stores')
@Unique(['businessId', 'name'])
export class StoreEntity {
  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Lekki Branch' })
  @Column()
  name: string;

  @ApiProperty({ example: '14 Admiralty Way, Lekki Phase 1' })
  @Column()
  address: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @Column({ nullable: true })
  city: string;

  @ApiPropertyOptional({ example: 'Lagos State' })
  @Column({ nullable: true })
  state: string;

  @ApiProperty({ example: '+2348012345678' })
  @Column()
  phone: string;

  @ApiProperty({ example: 'lekki@mrjollof.com' })
  @Column()
  email: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/stores/lekki.png', nullable: true })
  @Column({ nullable: true })
  logoUrl: string;

  @ApiPropertyOptional({ example: 'Our flagship Lekki location, open daily.', nullable: true })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({ example: 'Africa/Lagos', default: 'Africa/Lagos' })
  @Column({ default: 'Africa/Lagos' })
  timezone: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      monday: { open: '09:00', close: '22:00', closed: false },
      tuesday: { open: '09:00', close: '22:00', closed: false },
      saturday: { open: '10:00', close: '23:00', closed: false },
      sunday: { open: '12:00', close: '20:00', closed: false },
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  openingHours: WeeklyHours | null;

  @ApiPropertyOptional({ example: 5.0, nullable: true, description: 'Delivery coverage radius in kilometres' })
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  deliveryRadiusKm: number | null;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
