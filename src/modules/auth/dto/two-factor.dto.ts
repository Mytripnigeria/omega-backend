import { IsString, Length, Matches } from 'class-validator';

export class Verify2FADto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

export class Disable2FADto extends Verify2FADto {
  @IsString()
  password: string;
}
