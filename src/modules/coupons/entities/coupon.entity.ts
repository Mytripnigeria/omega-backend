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

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CouponMethod {
  /** Applied to the price of each eligible product instantly — the customer
   *  never has to type the code. */
  AUTOMATIC = 'automatic',
  /** Requires the customer to enter the code at checkout. */
  CODE = 'code',
}

export type CouponApplicableTo =
  | 'all'
  | 'specific_products'
  | 'specific_categories';

@Entity('coupons')
@Unique(['businessId', 'code'])
export class CouponEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'SAVE10' })
  @Column()
  code: string;

  @ApiPropertyOptional({ example: 'Welcome 10% off', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @ApiProperty({ enum: CouponType })
  @Column({ type: 'enum', enum: CouponType, default: CouponType.PERCENTAGE })
  type: CouponType;

  @ApiProperty({
    enum: CouponMethod,
    default: CouponMethod.CODE,
    description:
      'How this discount is applied. `automatic` discounts hit the price the moment the cart shows up; `code` discounts only kick in when the customer types the code at checkout.',
  })
  @Column({ type: 'enum', enum: CouponMethod, default: CouponMethod.CODE })
  method: CouponMethod;

  @ApiProperty({
    example: 10,
    description: 'Percentage (0–100) when type=percentage; fixed amount when type=fixed',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  value: number;

  @ApiPropertyOptional({ example: 5000, nullable: true })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minOrderAmount: number | null;

  @ApiPropertyOptional({
    example: 2000,
    nullable: true,
    description: 'Maximum absolute discount when type=percentage',
  })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxDiscount: number | null;

  @ApiPropertyOptional({
    example: 100,
    nullable: true,
    description: 'Total uses across all customers; null = unlimited',
  })
  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Per-customer usage cap; null = unlimited',
  })
  @Column({ type: 'int', nullable: true })
  perCustomerLimit: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({
    enum: ['all', 'specific_products', 'specific_categories'],
    default: 'all',
  })
  @Column({
    type: 'enum',
    enum: ['all', 'specific_products', 'specific_categories'],
    default: 'all',
  })
  applicableTo: CouponApplicableTo;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    description: 'Product IDs the coupon applies to (when applicableTo=specific_products)',
  })
  @Column({ type: 'simple-array', default: '' })
  productIds: string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    description: 'Category IDs the coupon applies to (when applicableTo=specific_categories)',
  })
  @Column({ type: 'simple-array', default: '' })
  categoryIds: string[];

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

@Entity('coupon_redemptions')
@Index(['couponId', 'customerId'])
export class CouponRedemptionEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  couponId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  customerId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ApiProperty({ example: 1000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  discountAmount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
