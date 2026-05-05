import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AddOnGroupEntity } from './addon-group.entity';

@Entity('addons')
export class AddOnEntity {
  @ApiProperty({ format: 'uuid', example: 'ao1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Grilled Chicken' })
  @Column()
  name: string;

  @ApiProperty({ example: 500.00, description: 'Additional charge for this addon in the business currency' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @ApiProperty({ example: true, description: '`false` when temporarily unavailable (e.g. sold out)' })
  @Column({ default: true })
  isAvailable: boolean;

  @ApiProperty({ format: 'uuid', example: 'ag1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column()
  addOnGroupId: string;

  @ManyToOne(() => AddOnGroupEntity, (g) => g.addons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addOnGroupId' })
  addOnGroup: AddOnGroupEntity;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
