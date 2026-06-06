import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type IntegrationProvider = 'paystack' | 'flutterwave';

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  'paystack',
  'flutterwave',
];

/**
 * Per-business payment-provider API credentials (Paystack, Flutterwave, …),
 * configured by the merchant in Settings → Integrations. Secret keys are stored
 * here but never returned raw by the API — only a masked preview.
 */
@Entity('integration_credentials')
@Unique(['businessId', 'provider'])
export class IntegrationCredentialEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ enum: INTEGRATION_PROVIDERS, example: 'paystack' })
  @Column({ type: 'varchar' })
  provider: IntegrationProvider;

  @ApiPropertyOptional({ description: 'Public/publishable key', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  publicKey: string | null;

  @ApiPropertyOptional({ description: 'Secret/API key (never returned raw)', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  secretKey: string | null;

  @ApiProperty({ example: false, description: 'Whether this provider is active' })
  @Column({ default: false })
  isEnabled: boolean;

  @ApiProperty({
    example: false,
    description: '`true` = live keys, `false` = test/sandbox keys',
  })
  @Column({ default: false })
  isLive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
