import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ActorType = 'admin' | 'staff' | 'user' | 'system';

@Entity('activity_log')
@Index(['businessId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
export class ActivityLogEntity {
  @ApiProperty({ format: 'uuid', example: 'al1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: ['admin', 'staff', 'user', 'system'], example: 'staff' })
  @Column({ type: 'enum', enum: ['admin', 'staff', 'user', 'system'] })
  actorType: ActorType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Null when actorType is "system"' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  actorId: string | null;

  @ApiProperty({ example: 'Amaka Okafor', description: 'Captured at write time so deleted users still render' })
  @Column({ type: 'varchar' })
  actorName: string;

  @ApiProperty({ example: 'shift.clocked_in', description: 'Dot-namespaced action key' })
  @Column({ type: 'varchar' })
  @Index()
  action: string;

  @ApiPropertyOptional({ example: 'shift', nullable: true, description: 'Resource type the action targets' })
  @Column({ type: 'varchar', nullable: true })
  resourceType: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'ID of the targeted resource' })
  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { from: 'scheduled', to: 'in-progress' },
    description: 'Free-form metadata describing the change',
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  storeId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;
}
