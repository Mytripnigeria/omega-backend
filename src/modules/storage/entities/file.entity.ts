import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('files')
@Index(['folder'])
@Index(['uploadedById'])
export class FileEntity {
  @ApiProperty({ format: 'uuid', example: 'f1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'products/2024/01/hero-image.jpg', description: 'Unique storage object key' })
  @Column({ unique: true })
  key: string;

  @ApiProperty({ example: 'https://cdn.mrjollof.com/products/2024/01/hero-image.jpg', description: 'Public CDN URL' })
  @Column()
  url: string;

  @ApiProperty({ example: 'hero-image.jpg', description: 'Original filename as uploaded by the client' })
  @Column()
  originalName: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type of the file' })
  @Column()
  mimetype: string;

  @ApiProperty({ example: 204800, description: 'File size in bytes (max 5 242 880 = 5 MB)' })
  @Column({ type: 'bigint' })
  size: number;

  @ApiPropertyOptional({ example: 'products', description: 'Logical folder path used to organise files in storage' })
  @Column({ nullable: true })
  folder: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, example: '3a1b2c3d-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Admin ID who uploaded the file' })
  @Column({ nullable: true, type: 'uuid' })
  uploadedById: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { width: 1200, height: 800, colorSpace: 'sRGB' },
    description: 'Arbitrary key-value metadata attached at upload time',
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
