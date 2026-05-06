import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import {
  MenuLayout,
  StoreStatus,
  StorefrontConfigEntity,
} from '../entities/storefront-config.entity';
import { Expose, Type, plainToInstance } from 'class-transformer';

export class UpdateStorefrontConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  storeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({ enum: StoreStatus })
  @IsOptional()
  @IsEnum(StoreStatus)
  storeStatus?: StoreStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  // theme

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  activeThemeId?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#1F2937' })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#F59E0B' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#0F172A' })
  @IsOptional()
  @IsHexColor()
  foregroundColor?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  // toggles

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlineOrderingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reservationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reviewsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  walletEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  // menu

  @ApiPropertyOptional({ enum: MenuLayout })
  @IsOptional()
  @IsEnum(MenuLayout)
  menuLayout?: MenuLayout;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  menuShowImages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  menuShowCalories?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  menuShowPrepTime?: boolean;

  // SEO

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  seoKeywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoOgImageUrl?: string;

  // social

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialInstagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialFacebook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialTwitter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialTiktok?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialYoutube?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialWhatsapp?: string;

  // notifications

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOnNewOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOnReservation?: boolean;

  // contact

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,20}$/)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactAddress?: string;
}

export class StorefrontConfigResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiProperty()
  @Expose()
  storeName: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  tagline: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  logoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  faviconUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customDomain: string | null;

  @ApiProperty({ enum: StoreStatus })
  @Expose()
  storeStatus: StoreStatus;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  maintenanceMessage: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  activeThemeId: string | null;

  @ApiProperty()
  @Expose()
  primaryColor: string;

  @ApiProperty()
  @Expose()
  secondaryColor: string;

  @ApiProperty()
  @Expose()
  accentColor: string;

  @ApiProperty()
  @Expose()
  backgroundColor: string;

  @ApiProperty()
  @Expose()
  foregroundColor: string;

  @ApiProperty()
  @Expose()
  fontFamily: string;

  @ApiProperty()
  @Expose()
  onlineOrderingEnabled: boolean;

  @ApiProperty()
  @Expose()
  reservationsEnabled: boolean;

  @ApiProperty()
  @Expose()
  reviewsEnabled: boolean;

  @ApiProperty()
  @Expose()
  walletEnabled: boolean;

  @ApiProperty()
  @Expose()
  loyaltyEnabled: boolean;

  @ApiProperty({ enum: MenuLayout })
  @Expose()
  menuLayout: MenuLayout;

  @ApiProperty()
  @Expose()
  menuShowImages: boolean;

  @ApiProperty()
  @Expose()
  menuShowCalories: boolean;

  @ApiProperty()
  @Expose()
  menuShowPrepTime: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  seoTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  seoDescription: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  seoKeywords: string[];

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  seoOgImageUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialInstagram: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialFacebook: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialTwitter: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialTiktok: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialYoutube: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  socialWhatsapp: string | null;

  @ApiProperty()
  @Expose()
  notifyOnNewOrder: boolean;

  @ApiProperty()
  @Expose()
  notifyOnReservation: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  contactEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  contactPhone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  contactAddress: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: StorefrontConfigEntity): StorefrontConfigResponseDto {
    return plainToInstance(StorefrontConfigResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
