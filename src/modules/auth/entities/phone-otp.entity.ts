import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PhoneOtpPurpose = 'login' | 'register';

/**
 * One-time codes for phone-number authentication. We store the *hash* of the
 * code (never the plaintext) so a DB compromise can't be replayed.
 *
 * Retention is short — we let rows accumulate and TTL-out via `expiresAt`
 * checks at verify time; a periodic sweep can purge consumed rows older than
 * a day in the future.
 */
@Entity('phone_otps')
@Index(['phone', 'businessId', 'consumed'])
export class PhoneOtpEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** E.164 normalised phone number, e.g. `+2348012345678`. */
  @Column({ type: 'varchar' })
  @Index()
  phone!: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId!: string;

  /** sha256(code) — the plaintext code is only ever sent via SMS. */
  @Column({ type: 'varchar' })
  codeHash!: string;

  @Column({ type: 'enum', enum: ['login', 'register'] })
  purpose!: PhoneOtpPurpose;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  /** Number of verify attempts against this code. */
  @Column({ type: 'int', default: 0 })
  attempts!: number;

  /** Set to true on successful verify so a code can't be replayed. */
  @Column({ default: false })
  consumed!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
