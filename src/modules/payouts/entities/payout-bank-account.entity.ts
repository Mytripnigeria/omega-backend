import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Bank accounts the merchant can pay out to. We register each one with the
 * payment provider (Paystack) on save and keep the resulting recipient code
 * so subsequent transfers reuse it.
 */
@Entity('payout_bank_accounts')
export class PayoutBankAccountEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'Main account' })
  @Column({ type: 'varchar' })
  label: string;

  @ApiProperty({ example: '0123456789' })
  @Column({ type: 'varchar' })
  accountNumber: string;

  @ApiProperty({ example: '058', description: 'Bank code (NUBAN)' })
  @Column({ type: 'varchar' })
  bankCode: string;

  @ApiPropertyOptional({ nullable: true, example: 'Guaranty Trust Bank' })
  @Column({ type: 'varchar', nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Mr Jollof Restaurant' })
  @Column({ type: 'varchar', nullable: true })
  accountName: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  recipientCode: string | null;

  @ApiProperty({ default: 'NGN' })
  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @ApiProperty({ default: false })
  @Column({ default: false })
  isDefault: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
