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

export enum PaymentMethodBrand {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  VERVE = 'verve',
  AMEX = 'amex',
  DISCOVER = 'discover',
  OTHER = 'other',
}

@Entity('customer_payment_methods')
@Unique(['customerId', 'authorizationCode'])
export class CustomerPaymentMethodEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  customerId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ enum: PaymentMethodBrand })
  @Column({ type: 'enum', enum: PaymentMethodBrand, default: PaymentMethodBrand.OTHER })
  brand: PaymentMethodBrand;

  @ApiProperty({ example: '4242' })
  @Column({ type: 'varchar', length: 4 })
  last4: string;

  @ApiProperty({ example: '12' })
  @Column({ type: 'varchar', length: 2 })
  expMonth: string;

  @ApiProperty({ example: '2027' })
  @Column({ type: 'varchar', length: 4 })
  expYear: string;

  @ApiPropertyOptional({ example: 'Adaeze Okonkwo', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  cardholderName: string | null;

  @ApiProperty({
    description:
      'Paystack-issued authorization code that lets the server charge this card on file',
  })
  @Column({ type: 'varchar' })
  authorizationCode: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  bin: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  bank: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

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
