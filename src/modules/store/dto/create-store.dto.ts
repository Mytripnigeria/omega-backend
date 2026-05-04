import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DayHoursDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open must be HH:MM (24h)' })
  open: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close must be HH:MM (24h)' })
  close: string;

  @IsBoolean()
  closed: boolean;
}

export class WeeklyHoursDto {
  @ValidateNested()
  @Type(() => DayHoursDto)
  monday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  tuesday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  wednesday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  thursday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  friday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  saturday: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  sunday: DayHoursDto;
}

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  openingHours?: WeeklyHoursDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deliveryRadiusKm?: number;
}
