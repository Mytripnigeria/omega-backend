import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class StorefrontRegisterDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Business this user belongs to (required because storefront is multi-tenant)',
  })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 'Amaka' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ example: 'amaka@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sup3rSecret!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'REF-A8K3',
    description:
      'Referral code from another customer. Awards both parties their configured bonus.',
  })
  @IsOptional()
  @IsString()
  referredByCode?: string;
}

export class StorefrontLoginDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 'amaka@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sup3rSecret!' })
  @IsString()
  @MinLength(1)
  password: string;
}
