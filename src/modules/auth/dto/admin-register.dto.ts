import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Self-signup payload for the merchant onboarding flow. Creates an admin,
 * their business, and their first store in a single transaction — the admin
 * is auto-logged-in and lands on the dashboard with a usable store context.
 */
export class AdminRegisterDto {
  // ── Admin account ───────────────────────────────────────────────────
  @ApiProperty({ example: 'Amaka Okafor' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: 'owner@mrjollof.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  // ── Business ────────────────────────────────────────────────────────
  @ApiProperty({ example: 'Mr Jollof' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiPropertyOptional({
    enum: ['restaurant', 'cafe', 'fast-food', 'bar', 'bakery', 'catering', 'food-truck', 'other'],
    description: 'Free-form category tag; stored on BusinessEntity.industry.',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ example: 'Best jollof in Lagos' })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({ example: 'Nigeria', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'EUR', 'GBP'] })
  @IsOptional()
  @IsIn(['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'EUR', 'GBP'])
  currency?: string;

  // ── First store ─────────────────────────────────────────────────────
  @ApiProperty({ example: 'Main Branch' })
  @IsString()
  @MinLength(2)
  storeName!: string;

  @ApiProperty({ example: '15 Admiralty Way, Lekki' })
  @IsString()
  storeAddress!: string;

  @ApiPropertyOptional({ example: 'Lekki' })
  @IsOptional()
  @IsString()
  storeCity?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  storeState?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  storePhone?: string;

  @ApiPropertyOptional({
    example: 'main@mrjollof.com',
    description: 'Defaults to the admin email if omitted.',
  })
  @IsOptional()
  @IsEmail()
  storeEmail?: string;
}
