import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export class CreateDomainDto {
  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_PATTERN, {
    message: 'Must be a valid hostname (e.g., shop.example.com)',
  })
  hostname: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
