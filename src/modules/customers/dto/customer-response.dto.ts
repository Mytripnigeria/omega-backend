import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  CustomerEntity,
  CustomerSource,
  CustomerStatus,
  LoyaltyTier,
} from '../entities/customer.entity';

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty({ example: 'Amaka' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @Expose()
  lastName: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  birthday: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  gender: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  country: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  state: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  city: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  street: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  zipCode: string | null;

  @ApiProperty({ enum: CustomerStatus })
  @Expose()
  status: CustomerStatus;

  @ApiProperty({ enum: CustomerSource })
  @Expose()
  source: CustomerSource;

  @ApiProperty({ example: 0 })
  @Expose()
  walletBalance: number;

  @ApiProperty({ example: 0 })
  @Expose()
  points: number;

  @ApiProperty({ enum: LoyaltyTier })
  @Expose()
  loyaltyTier: LoyaltyTier;

  @ApiProperty({ type: [String] })
  @Expose()
  groups: string[];

  @ApiProperty({ example: 'REF-A8K3' })
  @Expose()
  referralCode: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  referredBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  totalOrders: number;

  @ApiProperty({ example: 0 })
  @Expose()
  totalSpent: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  lastOrderAt: Date | null;

  @ApiProperty({ description: 'Whether this customer has a storefront login' })
  @Expose()
  hasUserAccount: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(
    entity: CustomerEntity,
    extras: { hasUserAccount?: boolean } = {},
  ): CustomerResponseDto {
    return plainToInstance(
      CustomerResponseDto,
      {
        ...entity,
        walletBalance: Number(entity.walletBalance),
        totalSpent: Number(entity.totalSpent),
        hasUserAccount: extras.hasUserAccount ?? false,
      },
      { excludeExtraneousValues: true },
    );
  }
}
