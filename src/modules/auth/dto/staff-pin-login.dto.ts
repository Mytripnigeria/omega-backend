import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class StaffPinLoginDto {
  // Staff codes are <prefix><digits>; the prefix is merchant-configurable
  // (default STF, e.g. MJS001), so accept any alphanumeric code here.
  @ApiProperty({ example: 'MJS001' })
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Invalid staff code format' })
  staffCode: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;

  @ApiPropertyOptional({ example: 6.5244, description: 'Device latitude (for geofenced login).' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.3792, description: 'Device longitude (for geofenced login).' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
