import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { VariationGroupEntity } from './variation-group.entity';

@Entity('variation_options')
export class VariationOptionEntity {
  @ApiProperty({ format: 'uuid', example: 'vo1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Large' })
  @Column()
  name: string;

  @ApiProperty({ format: 'uuid', example: 'vg1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  variationGroupId: string;

  @ManyToOne(() => VariationGroupEntity, (g) => g.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variationGroupId' })
  variationGroup: VariationGroupEntity;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
