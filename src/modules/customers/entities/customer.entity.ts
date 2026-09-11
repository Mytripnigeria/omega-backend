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

export enum CustomerStatus {
  ACTIVE = 'active',
  VIP = 'vip',
  INACTIVE = 'inactive',
}

export enum CustomerSource {
  WALK_IN = 'walk-in',
  STOREFRONT = 'storefront',
  REFERRAL = 'referral',
  IMPORT = 'import',
  /** Order arrived through the Chowdeck marketplace integration. */
  CHOWDECK = 'chowdeck',
  /** Order arrived through the CloveAI marketplace integration. */
  CLOVE = 'clove',
  OTHER = 'other',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

@Entity('customers')
@Unique(['businessId', 'email'])
@Unique(['businessId', 'phone'])
export class CustomerEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Amaka' })
  @Column()
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @Column()
  lastName: string;

  @ApiPropertyOptional({ example: 'amaka@example.com', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: '1995-04-12', nullable: true })
  @Column({ type: 'date', nullable: true })
  birthday: string | null;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'], nullable: true })
  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @ApiPropertyOptional({ example: 'Nigeria', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @ApiPropertyOptional({ example: 'Lagos', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @ApiPropertyOptional({ example: 'Lekki', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @ApiPropertyOptional({ example: '12B Admiralty Way', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  street: string | null;

  @ApiPropertyOptional({ example: '101245', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  zipCode: string | null;

  @ApiProperty({ enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status: CustomerStatus;

  @ApiProperty({ enum: CustomerSource, default: CustomerSource.WALK_IN })
  @Column({ type: 'enum', enum: CustomerSource, default: CustomerSource.WALK_IN })
  source: CustomerSource;

  @ApiProperty({ example: 0, description: 'Wallet balance in business currency' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  walletBalance: number;

  @ApiProperty({ example: 0, description: 'Loyalty points balance' })
  @Column({ type: 'int', default: 0 })
  points: number;

  @ApiProperty({ enum: LoyaltyTier, default: LoyaltyTier.BRONZE })
  @Column({ type: 'enum', enum: LoyaltyTier, default: LoyaltyTier.BRONZE })
  loyaltyTier: LoyaltyTier;

  @ApiProperty({
    type: [String],
    example: ['vip', 'newsletter'],
    description: 'Group/tag labels',
  })
  @Column({ type: 'simple-array', default: '' })
  groups: string[];

  @ApiProperty({ example: 'REF-A8K3', description: 'Customer-specific referral code' })
  @Column({ type: 'varchar', unique: true })
  referralCode: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Customer who referred this customer' })
  @Column({ type: 'uuid', nullable: true })
  referredBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Denormalised aggregates updated when an order is created/cancelled.
  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSpent: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastOrderAt: Date | null;

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
