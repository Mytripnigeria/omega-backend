import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class StaffLookupDto {
  // Prefix is merchant-configurable (default STF, e.g. MJS001).
  @ApiProperty({ example: 'MJS001' })
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Invalid staff code format' })
  staffCode: string;
}
