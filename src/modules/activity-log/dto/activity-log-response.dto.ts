import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { ActivityLogEntity, ActorType } from '../entities/activity-log.entity';

export class ActivityLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ enum: ['admin', 'staff', 'system'] })
  @Expose()
  actorType: ActorType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  actorId: string | null;

  @ApiProperty({ example: 'Amaka Okafor' })
  @Expose()
  actorName: string;

  @ApiProperty({ example: 'shift.clocked_in' })
  @Expose()
  action: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  resourceType: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  resourceId: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { from: 'scheduled', to: 'in-progress' },
  })
  @Expose()
  metadata: Record<string, unknown> | null;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  businessId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  storeId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  static from(entity: ActivityLogEntity): ActivityLogResponseDto {
    return plainToInstance(ActivityLogResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }

  static fromMany(entities: ActivityLogEntity[]): ActivityLogResponseDto[] {
    return entities.map((e) => ActivityLogResponseDto.from(e));
  }
}
