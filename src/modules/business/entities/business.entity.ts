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

@Entity('businesses')
export class BusinessEntity {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Mr. Jollof' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'Mr. Jollof Foods Limited', nullable: true })
  @Column({ nullable: true })
  legalName: string;

  @ApiPropertyOptional({ example: 'RC1234567', nullable: true })
  @Column({ nullable: true })
  registrationNumber: string;

  @ApiPropertyOptional({ example: '12345678-0001', nullable: true, description: 'Tax Identification Number' })
  @Column({ nullable: true })
  taxId: string;

  @ApiPropertyOptional({ example: 'hello@mrjollof.com', nullable: true })
  @Column({ nullable: true })
  email: string;

  @ApiPropertyOptional({ example: '+2348012345678', nullable: true })
  @Column({ nullable: true })
  phone: string;

  @ApiPropertyOptional({ example: '14 Admiralty Way, Lekki Phase 1, Lagos', nullable: true })
  @Column({ nullable: true, type: 'text' })
  address: string;

  @ApiProperty({ example: 'NGN', default: 'NGN', description: 'ISO 4217 currency code' })
  @Column({ default: 'NGN' })
  currency: string;

  @ApiProperty({ example: 'Africa/Lagos', default: 'Africa/Lagos' })
  @Column({ default: 'Africa/Lagos' })
  timezone: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'File ID of the uploaded logo' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  logoFileId: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png', nullable: true })
  @Column({ nullable: true })
  logoUrl: string;

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
