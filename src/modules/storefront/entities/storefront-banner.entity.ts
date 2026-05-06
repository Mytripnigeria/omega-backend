import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BannerTheme {
  LIGHT = 'light',
  DARK = 'dark',
}

@Entity('storefront_banners')
export class StorefrontBannerEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Weekend Special' })
  @Column()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({ type: 'varchar' })
  imageUrl: string;

  @ApiProperty({ enum: BannerTheme, default: BannerTheme.DARK })
  @Column({ type: 'enum', enum: BannerTheme, default: BannerTheme.DARK })
  theme: BannerTheme;

  @ApiPropertyOptional({ example: 'View Menu', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  actionText: string | null;

  @ApiPropertyOptional({ example: '/menu', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  actionUrl: string | null;

  @ApiProperty({ default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  position: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date | null;
}
