import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('storefront_theme_presets')
export class StorefrontThemePresetEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null for system seeded presets, otherwise the owning business',
  })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  businessId: string | null;

  @ApiProperty({ example: 'Modern Light' })
  @Column()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: '#3B82F6' })
  @Column({ type: 'varchar', length: 9 })
  primaryColor: string;

  @ApiProperty({ example: '#1F2937' })
  @Column({ type: 'varchar', length: 9 })
  secondaryColor: string;

  @ApiProperty({ example: '#F59E0B' })
  @Column({ type: 'varchar', length: 9 })
  accentColor: string;

  @ApiProperty({ example: '#FFFFFF' })
  @Column({ type: 'varchar', length: 9 })
  backgroundColor: string;

  @ApiProperty({ example: '#0F172A' })
  @Column({ type: 'varchar', length: 9 })
  foregroundColor: string;

  @ApiProperty({ example: 'Inter' })
  @Column({ default: 'Inter' })
  fontFamily: string;

  @ApiProperty({ default: true, description: 'System presets cannot be deleted' })
  @Column({ default: false })
  isSystem: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
