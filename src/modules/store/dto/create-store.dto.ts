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
  @ApiProperty({ example: '09:00', description: 'Opening time in HH:MM (24h)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open must be HH:MM (24h)' })
  open: string;

  @ApiProperty({ example: '22:00', description: 'Closing time in HH:MM (24h)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close must be HH:MM (24h)' })
  close: string;

  @ApiProperty({ example: false, description: 'true if the store is closed on this day' })
  @IsBoolean()
  closed: boolean;
}

export class WeeklyHoursDto {
  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  monday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  tuesday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  wednesday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  thursday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  friday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  saturday: DayHoursDto;

  @ApiProperty({ type: () => DayHoursDto })
  @ValidateNested()
  @Type(() => DayHoursDto)
  sunday: DayHoursDto;
}

export class CreateStoreDto {
  @ApiProperty({ example: 'Mr Jollof Victoria Island' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: '12 Adeola Odeku St, Victoria Island, Lagos' })
  @IsString()
  address: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'vi@mrjollof.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'https://cdn.mrjollof.com/logo.png', description: 'URL to the store logo image' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Our flagship Victoria Island location' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Africa/Lagos' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    type: () => WeeklyHoursDto,
    description: 'Per-day opening hours. Omit to leave unset.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  openingHours?: WeeklyHoursDto;

  @ApiPropertyOptional({ example: 10, description: 'Delivery radius in kilometres' })
  @IsOptional()
  @IsNumber()
  deliveryRadiusKm?: number;
}
