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

/**
 * A Chowdeck storefront ("channel") a store sells through.
 *
 * Scoped to the store, not the business: a Chowdeck `merchantReference`
 * identifies one vendor location, so each branch that sells on Chowdeck has
 * its own credentials and its own menu.
 *
 * A store may hold **several** channels — one restaurant unit often lists the
 * same kitchen under more than one Chowdeck vendor (different brands or
 * catchment areas). The natural key is therefore the merchant reference within
 * the store, not the store alone.
 */
@Entity('chowdeck_integrations')
@Unique(['storeId', 'merchantReference'])
export class ChowdeckIntegrationEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  storeId: string;

  @ApiPropertyOptional({
    example: 'Lekki storefront',
    nullable: true,
    description:
      'Merchant-facing name for this channel. Only needed to tell several ' +
      'channels on the same store apart.',
  })
  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @ApiProperty({
    example: 'ref_5ed0f23195c0fcd3da6b1fded5353974',
    description: "Chowdeck's identifier for this vendor location.",
  })
  @Column({ type: 'varchar' })
  @Index()
  merchantReference: string;

  @ApiProperty({
    writeOnly: true,
    description: 'Chowdeck secret key. Never returned raw — only masked.',
  })
  @Column({ type: 'varchar', select: false })
  secretKey: string;

  @ApiProperty({
    example: 'https://api.chowdeck.com',
    description: 'API base. Override only to point at a Chowdeck test host.',
  })
  @Column({ type: 'varchar', default: 'https://api.chowdeck.com' })
  baseUrl: string;

  @ApiProperty({
    example: false,
    description:
      'While false, webhooks for this store are rejected and no outbound ' +
      'status calls are made.',
  })
  @Column({ default: false })
  isEnabled: boolean;

  @ApiProperty({
    example: true,
    description:
      'Auto-accept incoming Chowdeck orders instead of parking them in the ' +
      'POS for a cashier to take on.',
  })
  @Column({ default: false })
  autoAccept: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Optional shared secret. When set, Chowdeck must post to ' +
      '/webhook/chowdeck/{token}; unauthenticated posts to the bare path are ' +
      'still accepted but are verified against Chowdeck before being trusted.',
  })
  @Column({ type: 'varchar', nullable: true, select: false })
  webhookToken: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastMenuSyncAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastWebhookAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
