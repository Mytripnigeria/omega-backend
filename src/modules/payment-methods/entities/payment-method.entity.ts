import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PaymentMethodType =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'pos'
  | 'mobile_money'
  | 'wallet'
  | 'other';

/** Channels a payment method can be shown on (mirrors product/category visibility). */
export type PaymentMethodChannel = 'pos' | 'self' | 'storefront' | 'omni';

export const PAYMENT_METHOD_CHANNELS: PaymentMethodChannel[] = [
  'pos',
  'self',
  'storefront',
  'omni',
];

@Entity('payment_methods')
@Unique(['businessId', 'label'])
export class PaymentMethodEntity {
  @ApiProperty({ format: 'uuid', example: 'pm1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({
    enum: ['cash', 'card', 'transfer', 'pos', 'mobile_money', 'wallet', 'other'],
    example: 'transfer',
    description: 'Canonical payment method type',
  })
  @Column({
    type: 'enum',
    enum: ['cash', 'card', 'transfer', 'pos', 'mobile_money', 'wallet', 'other'],
  })
  type: PaymentMethodType;

  @ApiProperty({ example: 'Bank Transfer', description: 'Display name shown on the POS checkout screen' })
  @Column()
  label: string;

  @ApiProperty({ example: true, description: '`false` hides this method from the POS checkout' })
  @Column({ default: true })
  isEnabled: boolean;

  @ApiProperty({
    type: [String],
    example: ['pos', 'self', 'storefront', 'omni'],
    description:
      'Channels this method is available on (Show on POS / Self-Order / ' +
      'Storefront / Omnichannels). Empty/absent = all channels.',
  })
  @Column({ type: 'simple-array', default: 'pos,self,storefront,omni' })
  visibility: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { accountNumber: '1234567890', bankCode: '058', bankName: 'GTBank' },
    description: 'Arbitrary configuration object (e.g. bank account details for transfers)',
  })
  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @ApiProperty({ example: 0, description: 'Display order on the checkout screen (0 = first)' })
  @Column({ type: 'int', default: 0 })
  order: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn()
  deletedAt: Date;
}
