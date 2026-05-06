import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { EventStatus, EventType } from '../entities/event.entity';

export class CreateEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ example: 'Corporate Dinner — TechCorp' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ example: '2026-05-25' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid start time' })
  startTime: string;

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid end time' })
  endTime: string;

  @ApiProperty({ example: 50, minimum: 1 })
  @IsInt()
  @Min(1)
  expectedGuests: number;

  @ApiProperty({ example: 'Sarah Okafor' })
  @IsString()
  @MinLength(1)
  contactName: string;

  @ApiProperty({ example: '+2348011112222' })
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid contact phone' })
  contactPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'Main Hall' })
  @IsOptional()
  @IsString()
  venueArea?: string;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, ['storeId'] as const),
) {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  confirmedGuests?: number;

  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean;
}

export class EventFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ example: 100000, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  asDeposit?: boolean;
}
