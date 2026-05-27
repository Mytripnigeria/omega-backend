import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class RequestPhoneOtpDto {
  @ApiProperty({ format: 'uuid', description: 'Storefront business id (same as VITE_BUSINESS_ID on the client).' })
  @IsUUID()
  businessId!: string;

  @ApiProperty({
    example: '+2348012345678',
    description:
      "Customer phone number. Local NG-format (e.g. '08012345678') is accepted and normalised to E.164 before storage.",
  })
  @IsString()
  @MinLength(7)
  phone!: string;

  @ApiPropertyOptional({
    enum: ['login', 'register'],
    default: 'login',
    description: 'Mark intent. Doesn\'t change the verify flow but is logged for analytics.',
  })
  @IsOptional()
  @IsIn(['login', 'register'])
  purpose?: 'login' | 'register';
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId!: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: '123456', description: '6-digit code received over SMS.' })
  @IsString()
  @Matches(/^\d{4,8}$/)
  @Length(4, 8)
  code!: string;

  // For first-time customers we need a name to create the record. These are
  // optional on the API and validated server-side: required only when the
  // (businessId, phone) pair has no customer yet.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Optional referral code from /register link.' })
  @IsOptional()
  @IsString()
  referredByCode?: string;
}
