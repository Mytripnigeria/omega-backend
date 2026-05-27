import { Inject, Injectable, Logger } from '@nestjs/common';
import { SMS_ADAPTER, type SmsAdapter } from './sms-adapter.interface';

/**
 * Thin façade around the selected {@link SmsAdapter}. Exists so callers don't
 * need to know which provider is active and so we can extend with retry
 * policy, rate limiting, etc. without touching the auth flow.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_ADAPTER) private readonly adapter: SmsAdapter,
  ) {}

  async send(to: string, body: string): Promise<boolean> {
    const ok = await this.adapter.send(to, body);
    if (!ok) {
      this.logger.warn(`SMS via ${this.adapter.name} failed for ${to}`);
    }
    return ok;
  }
}
