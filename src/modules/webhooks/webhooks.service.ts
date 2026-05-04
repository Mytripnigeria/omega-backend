import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHmac } from 'crypto';
import { WebhookEntity } from './entities/webhook.entity';
import { ALLOWED_WEBHOOK_EVENTS, CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

const ALLOWED = new Set<string>(ALLOWED_WEBHOOK_EVENTS as readonly string[]);

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEntity)
    private readonly repo: Repository<WebhookEntity>,
  ) {}

  list(businessId: string): Promise<WebhookEntity[]> {
    return this.repo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<WebhookEntity> {
    const webhook = await this.repo.findOne({ where: { id, businessId } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    return webhook;
  }

  private validateEvents(events: string[]): void {
    const bad = events.filter((e) => !ALLOWED.has(e));
    if (bad.length) {
      throw new BadRequestException(
        `Unknown event(s): ${bad.join(', ')}. Allowed: ${[...ALLOWED].join(', ')}`,
      );
    }
  }

  /** Generates a fresh secret. Returns the plaintext (caller must surface it once). */
  private generateSecret(): string {
    return `whsec_${randomBytes(32).toString('hex')}`;
  }

  async create(
    businessId: string,
    dto: CreateWebhookDto,
  ): Promise<{ webhook: WebhookEntity; secret: string }> {
    this.validateEvents(dto.events);
    const secret = this.generateSecret();
    const webhook = this.repo.create({
      ...dto,
      businessId,
      secret,
      secretLastFour: secret.slice(-4),
    });
    const saved = await this.repo.save(webhook);
    return { webhook: saved, secret };
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookEntity> {
    const webhook = await this.findOne(businessId, id);
    if (dto.events) this.validateEvents(dto.events);
    Object.assign(webhook, dto);
    return this.repo.save(webhook);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.repo.softDelete(id);
  }

  async rotateSecret(
    businessId: string,
    id: string,
  ): Promise<{ secret: string; secretLastFour: string }> {
    const webhook = await this.findOne(businessId, id);
    const secret = this.generateSecret();
    webhook.secret = secret;
    webhook.secretLastFour = secret.slice(-4);
    await this.repo.save(webhook);
    return { secret, secretLastFour: webhook.secretLastFour };
  }

  async test(
    businessId: string,
    id: string,
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    const webhook = await this.repo
      .createQueryBuilder('w')
      .addSelect('w.secret')
      .where('w.id = :id', { id })
      .andWhere('w.businessId = :businessId', { businessId })
      .getOne();
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);

    const payload = JSON.stringify({
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { businessId },
    });
    const signature = createHmac('sha256', webhook.secret).update(payload).digest('hex');

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mr-Jollof-Signature': signature,
          'X-Mr-Jollof-Event': 'webhook.test',
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });
      const ok = res.ok;
      await this.repo.update(id, {
        lastTriggeredAt: new Date(),
        failureCount: ok ? 0 : webhook.failureCount + 1,
      });
      return { ok, status: res.status };
    } catch (err) {
      await this.repo.update(id, {
        failureCount: webhook.failureCount + 1,
      });
      return { ok: false, error: (err as Error).message };
    }
  }
}
