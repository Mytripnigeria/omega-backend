import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { ShiftEntity, ShiftStatus } from '../entities/shift.entity';

export class ShiftResponseDto {
  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', example: 'c2d3e4f5-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  storeId: string;

  @ApiProperty({ format: 'uuid', example: '7c4a8d09-f2a3-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  staffId: string;

  @ApiProperty({ example: 'Amaka Okafor', description: 'Denormalised staff full name' })
  @Expose()
  staffName: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  roleId: string | null;

  @ApiPropertyOptional({ example: 'Cashier', nullable: true, description: 'Denormalised role name' })
  @Expose()
  roleName: string | null;

  @ApiProperty({ example: '2026-05-10' })
  @Expose()
  date: string;

  @ApiProperty({ example: '08:00' })
  @Expose()
  startTime: string;

  @ApiProperty({ example: '16:00' })
  @Expose()
  endTime: string;

  @ApiPropertyOptional({ example: 30, nullable: true })
  @Expose()
  breakDuration: number | null;

  @ApiProperty({ enum: ShiftStatus, example: ShiftStatus.SCHEDULED })
  @Expose()
  status: ShiftStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  actualClockIn: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  @Type(() => Date)
  actualClockOut: Date | null;

  @ApiPropertyOptional({ example: 'Cover for sick leave', nullable: true })
  @Expose()
  notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: ShiftEntity): ShiftResponseDto {
    return plainToInstance(
      ShiftResponseDto,
      {
        ...entity,
        staffName: entity.staff
          ? `${entity.staff.firstName} ${entity.staff.lastName}`
          : '',
        roleName: entity.role?.name ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  static fromMany(entities: ShiftEntity[]): ShiftResponseDto[] {
    return entities.map((e) => ShiftResponseDto.from(e));
  }
}
