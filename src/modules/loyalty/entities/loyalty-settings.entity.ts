import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('loyalty_settings')
@Unique(['businessId'])
export class LoyaltySettingsEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  businessId: string;

  @ApiProperty({
    example: 0.1,
    description: 'How many points the customer earns per ₦1 spent',
  })
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.1 })
  pointsPerNaira: number;

  @ApiProperty({
    example: 0.1,
    description: 'How many ₦ each redeemed point is worth (1 = 1 pt = ₦1)',
  })
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.1 })
  nairaPerPoint: number;

  @ApiProperty({
    example: 100,
    description: 'Minimum points balance required to redeem',
  })
  @Column({ type: 'int', default: 100 })
  minPointsToRedeem: number;

  @ApiProperty({
    example: 365,
    description: 'Days until earned points expire (0 = never)',
  })
  @Column({ type: 'int', default: 0 })
  pointsExpiryDays: number;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
