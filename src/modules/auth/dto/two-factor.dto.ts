import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class Verify2FADto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from an authenticator app' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

export class Disable2FADto extends Verify2FADto {
  @ApiProperty({ example: 'P@ssw0rd!', description: 'Current account password' })
  @IsString()
  password: string;
}
