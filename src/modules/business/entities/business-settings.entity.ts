import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('business_settings')
export class BusinessSettingsEntity {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryColumn('uuid')
  businessId: string;

  @ApiPropertyOptional({ example: 'Thank you for dining with us!', nullable: true })
  @Column({ nullable: true, type: 'text' })
  receiptHeader: string;

  @ApiPropertyOptional({ example: 'Visit us again at mrjollof.com', nullable: true })
  @Column({ nullable: true, type: 'text' })
  receiptFooter: string;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  receiptShowLogo: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  receiptShowItemPrices: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  receiptShowTaxBreakdown: boolean;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  receiptShowServerName: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  receiptShowOrderNumber: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  receiptCustomerCopy: boolean;

  @ApiPropertyOptional({
    example: '22:00',
    nullable: true,
    description: 'Start of do-not-disturb window (HH:MM, 24h). Null = no quiet hours.',
  })
  @Column({ nullable: true, type: 'varchar', length: 5 })
  notificationDoNotDisturbStart: string | null;

  @ApiPropertyOptional({
    example: '07:00',
    nullable: true,
    description: 'End of do-not-disturb window (HH:MM, 24h).',
  })
  @Column({ nullable: true, type: 'varchar', length: 5 })
  notificationDoNotDisturbEnd: string | null;

  @ApiProperty({
    example: 0.075,
    default: 0.075,
    description: 'VAT rate applied at checkout, expressed as a fraction (0.075 = 7.5%).',
  })
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.075 })
  taxRate: number;

  @ApiProperty({
    example: 'MJS',
    default: 'STF',
    description:
      'Prefix for auto-generated staff codes (e.g. "MJS" → MJS001). New staff ' +
      'only; existing codes are not renumbered.',
  })
  @Column({ type: 'varchar', length: 6, default: 'STF' })
  staffCodePrefix: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;
}
