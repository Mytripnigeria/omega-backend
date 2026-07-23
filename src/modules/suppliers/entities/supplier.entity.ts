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

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('suppliers')
@Unique(['businessId', 'name'])
export class SupplierEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Lagos Fresh Foods Ltd' })
  @Column()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  contactPerson: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ example: 'Net 30' })
  @Column({ type: 'varchar', nullable: true })
  paymentTerms: string | null;

  @ApiProperty({ example: 'Produce', description: 'Free-form category label' })
  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @ApiProperty({ enum: SupplierStatus, default: SupplierStatus.ACTIVE })
  @Column({ type: 'enum', enum: SupplierStatus, default: SupplierStatus.ACTIVE })
  status: SupplierStatus;

  @ApiPropertyOptional({ example: 4.7, nullable: true })
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Denormalised aggregates updated when ingredients are linked.
  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  totalIngredients: number;

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
