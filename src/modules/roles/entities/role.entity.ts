import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreEntity } from '../../store/entities/store.entity';

@Entity('roles')
export class RoleEntity {
  @ApiProperty({ format: 'uuid', example: 'd3e4f5a6-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  storeId: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: StoreEntity;

  @ApiProperty({ example: 'Cashier' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'Handles POS orders and payments', nullable: true })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({
    type: [String],
    example: ['view_products', 'create_orders', 'view_reports'],
    description: 'Permission strings — see GET /roles/permissions for the full list',
  })
  @Column('simple-array', { default: '' })
  permissions: string[];

  @ApiPropertyOptional({ example: '#4CAF50', nullable: true, description: 'Hex colour for UI display' })
  @Column({ nullable: true })
  color: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
