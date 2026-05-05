import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { VariationOptionEntity } from './variation-option.entity';

@Entity('variation_groups')
@Unique(['businessId', 'name'])
export class VariationGroupEntity {
  @ApiProperty({ format: 'uuid', example: 'vg1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Size', description: 'Name of the variation group (e.g. Size, Flavour, Spice Level)' })
  @Column()
  name: string;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ type: () => [VariationOptionEntity] })
  @OneToMany(() => VariationOptionEntity, (opt) => opt.variationGroup, {
    cascade: true,
    eager: false,
  })
  options: VariationOptionEntity[];

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
