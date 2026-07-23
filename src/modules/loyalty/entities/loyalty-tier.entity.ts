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

export type LoyaltyBenefitType =
  | 'discount'
  | 'free_shipping'
  | 'free_item'
  | 'points_multiplier'
  | 'exclusive_access';

export interface LoyaltyBenefit {
  id: string;
  type: LoyaltyBenefitType;
  value: number;
  description: string;
}

@Entity('loyalty_tiers')
@Unique(['businessId', 'name'])
export class LoyaltyTierEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Silver' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: 500, description: 'Minimum points required to be in this tier' })
  @Column({ type: 'int', default: 0 })
  minPoints: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 'bg-gray-100 text-gray-800',
    description: 'Tailwind color tokens for the tier badge',
  })
  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'List of perks the tier unlocks',
  })
  @Column({ type: 'jsonb', default: [] })
  benefits: LoyaltyBenefit[];

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

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
