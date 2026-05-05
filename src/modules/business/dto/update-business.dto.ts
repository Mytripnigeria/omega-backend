import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'Mr Jollof Foods Ltd', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Mr Jollof Foods Limited', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: 'RC-1234567', maxLength: 80, description: 'CAC or local business registration number' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: '12345678-0001', maxLength: 80, description: 'Tax Identification Number (TIN)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string;

  @ApiPropertyOptional({ example: 'hello@mrjollof.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: '5 Admiralty Way, Lekki Phase 1, Lagos', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'NGN', maxLength: 8, description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Lagos', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'FileEntity ID for the business logo; null to remove' })
  @IsOptional()
  @IsUUID()
  logoFileId?: string | null;
}
