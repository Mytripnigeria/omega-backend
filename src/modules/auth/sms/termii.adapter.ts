import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsAdapter } from './sms-adapter.interface';

/**
 * Termii (https://termii.com) SMS adapter — popular Nigerian provider. Uses
 * the v1 Messaging API. Falls back to logging-only behaviour when the API key
 * isn't set so dev environments don't accidentally hit a billed endpoint.
 *
 * Env:
 *   TERMII_API_KEY     — required to actually send
 *   TERMII_SENDER_ID   — registered sender (e.g. "MrJollof"), required by Termii
 *   TERMII_API_URL     — override for self-hosted / staging (defaults to prod)
 */
@Injectable()
export class TermiiSmsAdapter implements SmsAdapter {
  private readonly logger = new Logger(TermiiSmsAdapter.name);
  readonly name = 'termii';
  private readonly apiKey: string | undefined;
  private readonly senderId: string;
  private readonly apiUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('TERMII_API_KEY');
    this.senderId = config.get<string>('TERMII_SENDER_ID') ?? 'MrJollof';
    this.apiUrl =
      config.get<string>('TERMII_API_URL') ?? 'https://v3.api.termii.com';
  }

  async send(to: string, body: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        'TERMII_API_KEY not set — SMS will not be delivered. Set SMS_PROVIDER=console for dev.',
      );
      return false;
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from: this.senderId,
          sms: body,
          type: 'plain',
          channel: 'generic',
          api_key: this.apiKey,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logger.warn(
          `Termii rejected SMS to ${to}: HTTP ${res.status} ${errBody.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Termii delivery failed: ${(err as Error).message}`);
      return false;
    }
  }
}
