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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'Africa/Lagos' })
  timezone: string;

  @Column({ type: 'jsonb', nullable: true })
  openingHours: WeeklyHours | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  deliveryRadiusKm: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
