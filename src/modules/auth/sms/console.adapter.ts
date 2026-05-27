import { Injectable, Logger } from '@nestjs/common';
import type { SmsAdapter } from './sms-adapter.interface';

/**
 * Dev-friendly fallback: writes the OTP to backend logs so a developer can
 * verify the flow without buying SMS credits. Selected automatically when
 * `SMS_PROVIDER=console` (or when Termii env keys are missing).
 *
 * SAFETY: refuses to run when NODE_ENV=production unless `SMS_ALLOW_CONSOLE=1`
 * is explicitly set — printing OTPs to stdout in prod would be a real
 * vulnerability.
 */
@Injectable()
export class ConsoleSmsAdapter implements SmsAdapter {
  private readonly logger = new Logger(ConsoleSmsAdapter.name);
  readonly name = 'console';

  async send(to: string, body: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'production' && process.env.SMS_ALLOW_CONSOLE !== '1') {
      this.logger.error(
        `Refusing to send OTP via console adapter in production (set SMS_ALLOW_CONSOLE=1 to override). Recipient: ${to}`,
      );
      return false;
    }
    this.logger.log(`[SMS → ${to}] ${body}`);
    return true;
  }
}
