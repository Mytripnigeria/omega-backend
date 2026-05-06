import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface PaystackInitializeOptions {
  email: string;
  amount: number; // in kobo (smallest unit)
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaystackInitializeResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: 'success' | 'failed' | 'abandoned' | 'pending' | string;
  reference: string;
  amount: number; // in kobo
  currency: string;
  paidAt: string | null;
  channel: string | null;
  authorization?: {
    authorizationCode: string;
    bin: string | null;
    last4: string;
    expMonth: string;
    expYear: string;
    channel: string;
    cardType: string | null;
    bank: string | null;
    countryCode: string | null;
    brand: string | null;
    reusable: boolean;
    signature: string | null;
  };
  customer?: {
    email: string;
  };
  metadata?: Record<string, unknown>;
}

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

interface RawTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string | null;
  authorization?: {
    authorization_code: string;
    bin: string | null;
    last4: string;
    exp_month: string;
    exp_year: string;
    channel: string;
    card_type: string | null;
    bank: string | null;
    country_code: string | null;
    brand: string | null;
    reusable: boolean;
    signature: string | null;
  };
  customer?: { email: string };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  private secretKey(): string {
    const k = this.config.get<string>('paystack.secretKey') ?? '';
    if (!k) {
      throw new ServiceUnavailableException(
        'PAYSTACK_SECRET_KEY is not configured on the backend',
      );
    }
    return k;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('paystack.baseUrl') ?? 'https://api.paystack.co'
    );
  }

  publicKey(): string {
    return this.config.get<string>('paystack.publicKey') ?? '';
  }

  /**
   * Initialise a Paystack transaction. Returns the authorization URL the
   * frontend can redirect the customer to (or use with the inline popup).
   */
  async initialize(
    opts: PaystackInitializeOptions,
  ): Promise<PaystackInitializeResponse> {
    const res = await fetch(`${this.baseUrl()}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: opts.email,
        amount: Math.round(opts.amount),
        reference: opts.reference,
        callback_url: opts.callbackUrl,
        metadata: opts.metadata,
        channels: opts.channels,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Paystack initialize failed (${res.status}): ${body}`);
      throw new BadGatewayException('Failed to initialise payment');
    }

    const json = (await res.json()) as PaystackEnvelope<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>;

    if (!json.status) {
      throw new BadGatewayException(json.message || 'Failed to initialise payment');
    }
    return {
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
      reference: json.data.reference,
    };
  }

  async verify(reference: string): Promise<PaystackVerifyResponse> {
    const res = await fetch(
      `${this.baseUrl()}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey()}` },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Paystack verify failed (${res.status}): ${body}`);
      throw new BadGatewayException('Failed to verify payment');
    }
    const json = (await res.json()) as PaystackEnvelope<RawTransaction>;
    if (!json.status) {
      throw new BadGatewayException(json.message || 'Failed to verify payment');
    }
    return this.mapTransaction(json.data);
  }

  /**
   * Charge a saved authorization (one-click checkout). Used when the customer
   * picks a saved card. The card must have been verified beforehand.
   */
  async chargeAuthorization(opts: {
    email: string;
    amount: number; // kobo
    authorizationCode: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaystackVerifyResponse> {
    const res = await fetch(`${this.baseUrl()}/transaction/charge_authorization`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: opts.email,
        amount: Math.round(opts.amount),
        authorization_code: opts.authorizationCode,
        reference: opts.reference,
        metadata: opts.metadata,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Paystack charge_authorization failed (${res.status}): ${body}`,
      );
      throw new BadGatewayException('Failed to charge saved card');
    }
    const json = (await res.json()) as PaystackEnvelope<RawTransaction>;
    if (!json.status) {
      throw new BadGatewayException(
        json.message || 'Failed to charge saved card',
      );
    }
    return this.mapTransaction(json.data);
  }

  /**
   * Validate a Paystack webhook signature (header `x-paystack-signature`).
   * Webhooks are signed with HMAC-SHA512 using the secret key.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret =
      this.config.get<string>('paystack.webhookSecret') || this.secretKey();
    if (!signature) return false;
    const computed = createHmac('sha512', secret)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private mapTransaction(raw: RawTransaction): PaystackVerifyResponse {
    return {
      status: raw.status,
      reference: raw.reference,
      amount: raw.amount,
      currency: raw.currency,
      paidAt: raw.paid_at,
      channel: raw.channel,
      authorization: raw.authorization
        ? {
            authorizationCode: raw.authorization.authorization_code,
            bin: raw.authorization.bin,
            last4: raw.authorization.last4,
            expMonth: raw.authorization.exp_month,
            expYear: raw.authorization.exp_year,
            channel: raw.authorization.channel,
            cardType: raw.authorization.card_type,
            bank: raw.authorization.bank,
            countryCode: raw.authorization.country_code,
            brand: raw.authorization.brand,
            reusable: raw.authorization.reusable,
            signature: raw.authorization.signature,
          }
        : undefined,
      customer: raw.customer ? { email: raw.customer.email } : undefined,
      metadata: raw.metadata,
    };
  }
}
