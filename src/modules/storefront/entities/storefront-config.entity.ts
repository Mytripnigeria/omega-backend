import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StoreStatus {
  LIVE = 'live',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
}

export enum MenuLayout {
  GROUPED = 'grouped',
  GRID = 'grid',
  LIST = 'list',
}

@Entity('storefront_config')
export class StorefrontConfigEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn('uuid')
  businessId: string;

  // ---------- Branding / general ----------
  @ApiProperty({ example: 'Mr Jollof' })
  @Column({ type: 'varchar', default: '' })
  storeName: string;

  @ApiPropertyOptional({ example: 'Authentic Nigerian cuisine, cooked fresh.', nullable: true })
  @Column({ type: 'text', nullable: true })
  tagline: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  faviconUrl: string | null;

  @ApiPropertyOptional({ example: 'mrjollof.omegaos.com', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  customDomain: string | null;

  @ApiProperty({ enum: StoreStatus, default: StoreStatus.LIVE })
  @Column({ type: 'enum', enum: StoreStatus, default: StoreStatus.LIVE })
  storeStatus: StoreStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  maintenanceMessage: string | null;

  // ---------- Theme ----------
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  activeThemeId: string | null;

  @ApiProperty({ example: '#3B82F6' })
  @Column({ type: 'varchar', length: 9, default: '#3B82F6' })
  primaryColor: string;

  @ApiProperty({ example: '#1F2937' })
  @Column({ type: 'varchar', length: 9, default: '#1F2937' })
  secondaryColor: string;

  @ApiProperty({ example: '#F59E0B' })
  @Column({ type: 'varchar', length: 9, default: '#F59E0B' })
  accentColor: string;

  @ApiProperty({ example: '#FFFFFF' })
  @Column({ type: 'varchar', length: 9, default: '#FFFFFF' })
  backgroundColor: string;

  @ApiProperty({ example: '#0F172A' })
  @Column({ type: 'varchar', length: 9, default: '#0F172A' })
  foregroundColor: string;

  @ApiProperty({ example: 'Inter' })
  @Column({ type: 'varchar', default: 'Inter' })
  fontFamily: string;

  // ---------- Feature toggles ----------
  @ApiProperty({ default: true })
  @Column({ default: true })
  onlineOrderingEnabled: boolean;

  @ApiProperty({ default: true })
  @Column({ default: true })
  reservationsEnabled: boolean;

  @ApiProperty({ default: false })
  @Column({ default: false })
  reviewsEnabled: boolean;

  @ApiProperty({ default: true })
  @Column({ default: true })
  walletEnabled: boolean;

  @ApiProperty({ default: true })
  @Column({ default: true })
  loyaltyEnabled: boolean;

  // ---------- Menu display ----------
  @ApiProperty({ enum: MenuLayout, default: MenuLayout.GROUPED })
  @Column({ type: 'enum', enum: MenuLayout, default: MenuLayout.GROUPED })
  menuLayout: MenuLayout;

  @ApiProperty({ default: true })
  @Column({ default: true })
  menuShowImages: boolean;

  @ApiProperty({ default: false })
  @Column({ default: false })
  menuShowCalories: boolean;

  @ApiProperty({ default: false })
  @Column({ default: false })
  menuShowPrepTime: boolean;

  // ---------- SEO ----------
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  seoTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  seoDescription: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @Column({ type: 'simple-array', default: '' })
  seoKeywords: string[];

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  seoOgImageUrl: string | null;

  // ---------- Social ----------
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialInstagram: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialFacebook: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialTwitter: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialTiktok: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialYoutube: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  socialWhatsapp: string | null;

  // ---------- Notifications ----------
  @ApiProperty({ default: true })
  @Column({ default: true })
  notifyOnNewOrder: boolean;

  @ApiProperty({ default: true })
  @Column({ default: true })
  notifyOnReservation: boolean;

  // ---------- Misc ----------
  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  contactEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  contactPhone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  contactAddress: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
