import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export class CreateDomainDto {
  @ApiProperty({
    example: 'order.mrjollof.com',
    maxLength: 253,
    description: 'Fully qualified domain name to register. Add the returned DNS TXT record at your registrar, then call POST /domains/:id/verify.',
  })
  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_PATTERN, {
    message: 'Must be a valid hostname (e.g., shop.example.com)',
  })
  hostname: string;

  @ApiPropertyOptional({ example: false, description: 'true = immediately set as the primary domain after verification' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
