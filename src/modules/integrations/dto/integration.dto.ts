import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  IntegrationCredentialEntity,
  IntegrationProvider,
} from '../entities/integration-credential.entity';

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Public/publishable key' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  publicKey?: string;

  @ApiPropertyOptional({
    description: 'Secret/API key. Omit to keep the existing secret unchanged.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  secretKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'true = live keys, false = test keys' })
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;
}

export class IntegrationResponseDto {
  @ApiProperty({ example: 'paystack' })
  provider: IntegrationProvider;

  @ApiProperty({ nullable: true })
  publicKey: string | null;

  /** Masked secret preview, e.g. "sk_live_••••4f2a". Never the raw secret. */
  @ApiProperty({ nullable: true })
  secretKeyMasked: string | null;

  @ApiProperty({ description: 'Whether a secret key has been saved' })
  secretKeySet: boolean;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  isLive: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;

  /**
   * @param decryptedSecret the plaintext secret (decrypted from storage) used
   *   only to derive the masked preview — never returned in full.
   */
  static from(
    provider: IntegrationProvider,
    e: IntegrationCredentialEntity | null,
    decryptedSecret: string | null,
  ): IntegrationResponseDto {
    const dto = new IntegrationResponseDto();
    dto.provider = provider;
    dto.publicKey = e?.publicKey ?? null;
    dto.secretKeySet = !!decryptedSecret;
    dto.secretKeyMasked = decryptedSecret ? maskSecret(decryptedSecret) : null;
    dto.isEnabled = e?.isEnabled ?? false;
    dto.isLive = e?.isLive ?? false;
    dto.updatedAt = e?.updatedAt ?? null;
    return dto;
  }
}

function maskSecret(secret: string): string {
  const last4 = secret.slice(-4);
  // Keep any provider prefix (e.g. "sk_live_") visible for context.
  const prefixMatch = secret.match(/^[a-z]+_[a-z]+_/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  return `${prefix}••••${last4}`;
}
