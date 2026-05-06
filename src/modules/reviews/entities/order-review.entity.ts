import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('order_reviews')
@Unique(['orderId'])
export class OrderReviewEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  storeId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  customerId: string;

  @ApiProperty({ example: 'Adaeze Okonkwo', description: 'Captured at write time' })
  @Column()
  customerName: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Column({ type: 'int' })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ default: false })
  @Column({ default: false })
  isPublished: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
