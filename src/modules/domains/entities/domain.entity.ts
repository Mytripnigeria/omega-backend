import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SslStatus = 'pending' | 'active' | 'failed';

@Entity('domains')
export class DomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @Column({ unique: true })
  hostname: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column()
  verificationToken: string;

  @Column({ type: 'jsonb', nullable: true })
  dnsRecords: { type: string; name: string; value: string }[] | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'failed'],
    default: 'pending',
  })
  sslStatus: SslStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
