import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class StaffLookupDto {
  @ApiProperty({ example: 'STF001' })
  @IsString()
  @Matches(/^STF\d+$/, { message: 'Invalid staff code format' })
  staffCode: string;
}
