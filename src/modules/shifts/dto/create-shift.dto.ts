import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({ format: 'uuid', example: 's1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Store this shift belongs to' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ format: 'uuid', example: 'sf1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Staff member scheduled for this shift' })
  @IsUUID()
  staffId: string;

  @ApiPropertyOptional({ format: 'uuid', example: 'r1a2b3c4-1234-4f1a-8c3e-9a4f0c4e2b21', description: 'Role the staff member will work as during this shift' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiProperty({ example: '2024-01-20', description: 'Shift date in ISO 8601 format' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '08:00', description: 'Scheduled start time in HH:MM (24h)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format HH:MM' })
  startTime: string;

  @ApiProperty({ example: '16:00', description: 'Scheduled end time in HH:MM (24h)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format HH:MM' })
  endTime: string;

  @ApiPropertyOptional({ example: 30, description: 'Scheduled break duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakDuration?: number;

  @ApiPropertyOptional({ example: 'Please arrive 15 minutes early for briefing.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
