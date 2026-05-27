import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type PushSubjectType = 'customer' | 'staff';

/**
 * One row per browser/device subscribed to web push. The triplet
 * (endpoint, p256dh, auth) is the W3C PushSubscription contract — we send
 * notifications to `endpoint` and encrypt payloads with the keys.
 *
 * We keep a `subjectType + subjectId` reference instead of a polymorphic FK so
 * the same table can serve both storefront customers (the primary use case)
 * and, later, staff for workstation notifications.
 */
@Entity('push_subscriptions')
@Unique(['subjectType', 'subjectId', 'endpoint'])
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['customer', 'staff'] })
  @Index()
  subjectType!: PushSubjectType;

  @Column({ type: 'uuid' })
  @Index()
  subjectId!: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId!: string;

  /** The push service URL (FCM / Mozilla autopush / etc.). */
  @Column({ type: 'text' })
  endpoint!: string;

  /** Browser-provided ECDH public key, base64url-encoded. */
  @Column({ type: 'text' })
  p256dh!: string;

  /** Browser-provided auth secret, base64url-encoded. */
  @Column({ type: 'text' })
  auth!: string;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  /** Updated when the subscription is touched (re-subscribed or delivered to). */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
