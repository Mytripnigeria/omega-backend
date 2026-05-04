import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class StaffPinLoginDto {
  @ApiProperty({ example: 'STF001' })
  @IsString()
  @Matches(/^STF\d+$/, { message: 'Invalid staff code format' })
  staffCode: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}
