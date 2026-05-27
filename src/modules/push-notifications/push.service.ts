import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webPush from 'web-push';
import {
  PushSubjectType,
  PushSubscriptionEntity,
} from './entities/push-subscription.entity';
import { CreatePushSubscriptionDto } from './dto/push-subscription.dto';

export interface PushNotificationPayload {
  title: string;
  body: string;
  /** Optional path the SW will navigate to on click (e.g. `/order-tracking/abc`). */
  url?: string;
  /** Free-form payload for the SW (e.g. orderId, status). */
  data?: Record<string, unknown>;
}

/**
 * Web-push delivery. Subscriptions are stored per-subject (customer or staff);
 * `sendToSubject` fans the payload out to every active subscription for that
 * subject and prunes any that come back with 404/410 (Gone) — that's how the
 * push service tells us the browser has uninstalled / disabled push.
 *
 * Boot-time behaviour: if the `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` env
 * vars are missing the module logs a single warning and `sendToSubject` is a
 * no-op (graceful degradation) — clients can still subscribe so once VAPID is
 * configured pushes start flowing.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private vapidPublicKey: string | null = null;
  private vapidPrivateKey: string | null = null;
  private vapidSubject = 'mailto:ops@mrjollof.local';
  private configured = false;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly subRepo: Repository<PushSubscriptionEntity>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (!pub || !priv) {
      this.logger.warn(
        'VAPID keys not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — web push will be disabled until they are set. Generate with `npx web-push generate-vapid-keys`.',
      );
      return;
    }
    if (subject) this.vapidSubject = subject;
    this.vapidPublicKey = pub;
    this.vapidPrivateKey = priv;
    webPush.setVapidDetails(this.vapidSubject, pub, priv);
    this.configured = true;
  }

  /** Public VAPID key. Exposed as `/notifications/web-push/public-key`. */
  getPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  async subscribe(
    subjectType: PushSubjectType,
    subjectId: string,
    businessId: string,
    dto: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionEntity> {
    // Upsert by (subjectType, subjectId, endpoint) — re-subscribing from the
    // same browser keeps the same row and refreshes lastSeenAt + keys.
    const existing = await this.subRepo.findOne({
      where: { subjectType, subjectId, endpoint: dto.endpoint },
    });
    if (existing) {
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      existing.userAgent = dto.userAgent ?? existing.userAgent;
      existing.lastSeenAt = new Date();
      return this.subRepo.save(existing);
    }
    const row = this.subRepo.create({
      subjectType,
      subjectId,
      businessId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent ?? null,
      lastSeenAt: new Date(),
    });
    return this.subRepo.save(row);
  }

  async listForSubject(
    subjectType: PushSubjectType,
    subjectId: string,
  ): Promise<PushSubscriptionEntity[]> {
    return this.subRepo.find({
      where: { subjectType, subjectId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Removes a subscription by id, only if it belongs to the subject. */
  async unsubscribe(
    subjectType: PushSubjectType,
    subjectId: string,
    id: string,
  ): Promise<void> {
    await this.subRepo.delete({ id, subjectType, subjectId });
  }

  /**
   * Best-effort fan-out push to every active subscription for a subject.
   * Returns the number delivered. Dead endpoints (404 / 410) are cleaned up
   * so the table doesn't grow unbounded with stale device tokens.
   */
  async sendToSubject(
    subjectType: PushSubjectType,
    subjectId: string,
    payload: PushNotificationPayload,
  ): Promise<number> {
    if (!this.configured) return 0;
    const subs = await this.listForSubject(subjectType, subjectId);
    if (subs.length === 0) return 0;
    const json = JSON.stringify(payload);
    let delivered = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            json,
          );
          sub.lastSeenAt = new Date();
          await this.subRepo.save(sub);
          delivered += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            // Browser unsubscribed — prune.
            await this.subRepo.delete(sub.id);
          } else {
            this.logger.warn(
              `Push delivery failed for sub ${sub.id}: ${(err as Error).message}`,
            );
          }
        }
      }),
    );
    return delivered;
  }

  /** Helper for the orders module — pushes a status update to a customer. */
  async sendToCustomer(
    customerId: string,
    payload: PushNotificationPayload,
  ): Promise<number> {
    return this.sendToSubject('customer', customerId, payload);
  }
}
