import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StorefrontGoogleAuthDto {
  @ApiProperty({ format: 'uuid', description: 'Business the customer belongs to' })
  @IsUUID()
  businessId: string;

  @ApiProperty({
    description: 'Google ID token (JWT) obtained client-side via Google Identity Services',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ description: 'Referral code to attribute a first-time signup to' })
  @IsOptional()
  @IsString()
  referredByCode?: string;
}
