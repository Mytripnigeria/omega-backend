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
import { ApiProperty } from '@nestjs/swagger';

@Entity('tax_rates')
@Unique(['businessId', 'name'])
export class TaxRateEntity {
  @ApiProperty({ format: 'uuid', example: 'tr1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'VAT' })
  @Column()
  name: string;

  @ApiProperty({ example: 7.5, description: 'Tax rate as a percentage (e.g. 7.5 = 7.5%)' })
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  ratePercent: number;

  @ApiProperty({
    example: false,
    description: '`true` = tax is already included in the product price; `false` = tax is added on top at checkout',
  })
  @Column({ default: false })
  isInclusive: boolean;

  @ApiProperty({ example: false, description: '`true` = automatically applied to all new products' })
  @Column({ default: false })
  isDefault: boolean;

  @ApiProperty({ example: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
