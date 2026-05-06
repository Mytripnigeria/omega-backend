import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum BreakType {
  LUNCH = 'lunch',
  REST = 'rest',
  OTHER = 'other',
}

export class CreateBreakDto {
  @ApiProperty({ enum: BreakType, example: BreakType.LUNCH })
  @IsEnum(BreakType)
  type: BreakType;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-05-10T12:00:00Z',
    description: 'When the break started',
  })
  @IsISO8601()
  startTime: string;

  @ApiProperty({ example: 30, minimum: 1, maximum: 480, description: 'Duration in minutes' })
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes: number;

  @ApiPropertyOptional({ example: 'Mid-shift lunch', maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
