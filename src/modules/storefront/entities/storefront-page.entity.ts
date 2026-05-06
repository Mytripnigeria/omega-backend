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

export enum PageTemplate {
  HOMEPAGE = 'homepage',
  MENU = 'menu',
  STANDARD = 'standard',
  CONTACT = 'contact',
  FAQ = 'faq',
}

export enum PageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('storefront_pages')
@Unique(['businessId', 'slug'])
export class StorefrontPageEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'About Us' })
  @Column()
  name: string;

  @ApiProperty({ example: 'about', description: 'URL slug, unique per business' })
  @Column()
  slug: string;

  @ApiProperty({ enum: PageTemplate, default: PageTemplate.STANDARD })
  @Column({ type: 'enum', enum: PageTemplate, default: PageTemplate.STANDARD })
  template: PageTemplate;

  @ApiProperty({ enum: PageStatus, default: PageStatus.DRAFT })
  @Column({ type: 'enum', enum: PageStatus, default: PageStatus.DRAFT })
  status: PageStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  metaTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  content: string | null;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  position: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  views: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

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
