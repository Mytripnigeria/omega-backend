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

export type SslStatus = 'pending' | 'active' | 'failed';

@Entity('domains')
export class DomainEntity {
  @ApiProperty({ format: 'uuid', example: 'dm1a2b3c-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @ApiProperty({ example: 'order.mrjollof.com' })
  @Column({ unique: true })
  hostname: string;

  @ApiProperty({ example: false, description: '`true` if this is the primary domain for the business' })
  @Column({ default: false })
  isPrimary: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'When DNS ownership was confirmed' })
  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @ApiProperty({ example: 'omega-verify-a1b2c3d4', description: 'TXT record value to add at your DNS provider' })
  @Column()
  verificationToken: string;

  @ApiPropertyOptional({
    type: 'array',
    nullable: true,
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'TXT' },
        name: { type: 'string', example: '_omega-verify.order.mrjollof.com' },
        value: { type: 'string', example: 'omega-verify-a1b2c3d4' },
      },
    },
    description: 'DNS records to add at your registrar to prove ownership',
  })
  @Column({ type: 'jsonb', nullable: true })
  dnsRecords: { type: string; name: string; value: string }[] | null;

  @ApiProperty({
    enum: ['pending', 'active', 'failed'],
    example: 'pending',
    description: '`active` = SSL provisioned and domain is live',
  })
  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'failed'],
    default: 'pending',
  })
  sslStatus: SslStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
