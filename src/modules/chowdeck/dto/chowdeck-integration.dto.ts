import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpsertChowdeckIntegrationDto {
  @ApiPropertyOptional({
    description:
      'Force creation of an additional channel instead of updating the ' +
      "store's existing one. Set by the hub's \"Add channel\" action.",
  })
  @IsOptional()
  @IsBoolean()
  createNew?: boolean;

  @ApiPropertyOptional({
    example: 'Lekki storefront',
    description:
      'Merchant-facing name, to tell several channels on one store apart.',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 'ref_5ed0f23195c0fcd3da6b1fded5353974',
    description: "Chowdeck's reference for this vendor location.",
  })
  @IsOptional()
  @IsString()
  merchantReference?: string;

  @ApiPropertyOptional({
    example: 'sk_test_…',
    description:
      'Chowdeck secret key. Omit when updating to keep the stored key — the ' +
      'API only ever returns a masked preview.',
  })
  @IsOptional()
  @IsString()
  secretKey?: string;

  @ApiPropertyOptional({ example: 'https://api.chowdeck.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'While false, webhooks are rejected and nothing is pushed out.',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Accept incoming Chowdeck orders automatically instead of parking them ' +
      'in the POS for a cashier.',
  })
  @IsOptional()
  @IsBoolean()
  autoAccept?: boolean;
}

/**
 * Chowdeck's webhook envelope.
 *
 * Deliberately an interface, not a validated class: the global ValidationPipe
 * runs with `forbidNonWhitelisted`, so a class DTO would reject the payload
 * outright over the many fields we don't declare. Third-party bodies are
 * validated by hand instead — and, more importantly, the order is re-fetched
 * from Chowdeck before any of it is trusted.
 */
export interface ChowdeckWebhookBody {
  /** e.g. ORDER_CREATED, ORDER_COMPLETE. */
  category?: string;
  event?: string;
  description?: string;
  payload?: {
    id?: number;
    reference?: string;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
