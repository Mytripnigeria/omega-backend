import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
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
export class PaystackService implements OnModuleInit {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Operators need to know about a misconfigured Paystack at boot — not
    // when the first customer hits checkout.
    if (!this.config.get<string>('paystack.secretKey')) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY is not configured — Paystack checkouts will fail.',
      );
    }
    if (!this.config.get<string>('paystack.publicKey')) {
      this.logger.warn(
        'PAYSTACK_PUBLIC_KEY is not configured — the inline popup will not load on the storefront.',
      );
    }
    if (!this.config.get<string>('paystack.webhookSecret')) {
      this.logger.warn(
        'PAYSTACK_WEBHOOK_SECRET is not set — falling back to PAYSTACK_SECRET_KEY for webhook verification.',
      );
    }
  }

  private secretKey(): string {
    const k = this.config.get<string>('paystack.secretKey') ?? '';
    if (!k) {
      throw new ServiceUnavailableException(
        'PAYSTACK_SECRET_KEY is not configured on the backend',
      );
    }
    return k;
  }

  /**
   * Resolves the Paystack secret to use for a call. A per-merchant override
   * (the business's own saved key) takes precedence; only admin/global flows
   * fall back to the platform env key. Tenant-specific flows (storefront
   * payments) MUST pass the merchant's key so one merchant never transacts on
   * another merchant's Paystack account.
   */
  private resolveSecret(override?: string): string {
    const k = override?.trim();
    if (k) return k;
    return this.secretKey();
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
    secretOverride?: string,
  ): Promise<PaystackInitializeResponse> {
    const res = await fetch(`${this.baseUrl()}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resolveSecret(secretOverride)}`,
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

  async verify(
    reference: string,
    secretOverride?: string,
  ): Promise<PaystackVerifyResponse> {
    const res = await fetch(
      `${this.baseUrl()}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.resolveSecret(secretOverride)}` },
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
  async chargeAuthorization(
    opts: {
      email: string;
      amount: number; // kobo
      authorizationCode: string;
      reference: string;
      metadata?: Record<string, unknown>;
    },
    secretOverride?: string,
  ): Promise<PaystackVerifyResponse> {
    const res = await fetch(`${this.baseUrl()}/transaction/charge_authorization`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resolveSecret(secretOverride)}`,
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
   * Issue a refund for a previously-paid Paystack transaction. Defaults to
   * a full refund when `amount` is omitted. Returns Paystack's raw refund
   * response shape.
   */
  async refund(
    reference: string,
    amount?: number,
    secretOverride?: string,
  ): Promise<{
    id: number | string;
    transaction: { reference: string };
    amount: number;
    status: string;
  }> {
    const res = await fetch(`${this.baseUrl()}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resolveSecret(secretOverride)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: reference,
        ...(amount != null ? { amount: Math.round(amount) } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Paystack refund failed (${res.status}): ${body}`);
      throw new BadGatewayException('Failed to issue refund');
    }
    const json = (await res.json()) as PaystackEnvelope<{
      id: number | string;
      transaction: { reference: string };
      amount: number;
      status: string;
    }>;
    if (!json.status) {
      throw new BadGatewayException(json.message || 'Refund rejected by Paystack');
    }
    return json.data;
  }

  /**
   * Register a transfer recipient (a bank account) on Paystack. The returned
   * `recipientCode` is the persistent handle to use in `transfer()`.
   */
  async createTransferRecipient(opts: {
    name: string;
    accountNumber: string;
    bankCode: string;
    currency?: string;
  }): Promise<{
    recipientCode: string;
    bankName: string | null;
    accountName: string | null;
  }> {
    const res = await fetch(`${this.baseUrl()}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: opts.name,
        account_number: opts.accountNumber,
        bank_code: opts.bankCode,
        currency: opts.currency ?? 'NGN',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Paystack transferrecipient failed (${res.status}): ${body}`,
      );
      throw new BadGatewayException('Failed to register payout recipient');
    }
    const json = (await res.json()) as PaystackEnvelope<{
      recipient_code: string;
      details?: { account_name?: string; bank_name?: string };
    }>;
    if (!json.status) {
      throw new BadGatewayException(
        json.message || 'Paystack rejected the recipient details',
      );
    }
    return {
      recipientCode: json.data.recipient_code,
      bankName: json.data.details?.bank_name ?? null,
      accountName: json.data.details?.account_name ?? null,
    };
  }

  /**
   * Initiate a transfer to a previously-registered recipient. Returns the
   * transfer's reference + Paystack status string. The transfer is usually
   * `pending` until Paystack settles it; the webhook (`transfer.success` /
   * `transfer.failed`) closes it out.
   */
  async transfer(opts: {
    recipientCode: string;
    amount: number; // kobo
    reference: string;
    reason?: string;
  }): Promise<{
    transferCode: string;
    reference: string;
    status: string;
    amount: number;
  }> {
    const res = await fetch(`${this.baseUrl()}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        recipient: opts.recipientCode,
        amount: Math.round(opts.amount),
        reference: opts.reference,
        reason: opts.reason ?? `Payout ${opts.reference}`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Paystack transfer failed (${res.status}): ${body}`);
      throw new BadGatewayException('Failed to initiate transfer');
    }
    const json = (await res.json()) as PaystackEnvelope<{
      transfer_code: string;
      reference: string;
      status: string;
      amount: number;
    }>;
    if (!json.status) {
      throw new BadGatewayException(
        json.message || 'Paystack rejected the transfer',
      );
    }
    return {
      transferCode: json.data.transfer_code,
      reference: json.data.reference,
      status: json.data.status,
      amount: json.data.amount,
    };
  }

  /**
   * Look up a previously-initiated transfer by its reference. Used by the
   * payout worker to reconcile state when the webhook is delayed.
   */
  async verifyTransfer(reference: string): Promise<{
    reference: string;
    status: string;
    amount: number;
  }> {
    const res = await fetch(
      `${this.baseUrl()}/transfer/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey()}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Paystack verify transfer failed (${res.status}): ${body}`,
      );
      throw new BadGatewayException('Failed to verify transfer');
    }
    const json = (await res.json()) as PaystackEnvelope<{
      reference: string;
      status: string;
      amount: number;
    }>;
    if (!json.status) {
      throw new BadGatewayException(
        json.message || 'Paystack returned an error on verify',
      );
    }
    return json.data;
  }

  /**
   * Validate a Paystack webhook signature (header `x-paystack-signature`).
   * Webhooks are signed with HMAC-SHA512 using the secret key.
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secretOverride?: string,
  ): boolean {
    // Paystack signs webhooks with the account's secret key. For multi-tenant
    // setups pass the paying merchant's secret so each merchant's events verify
    // against their own account; fall back to the platform key otherwise.
    const secret =
      secretOverride?.trim() ||
      this.config.get<string>('paystack.webhookSecret') ||
      this.secretKey();
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
