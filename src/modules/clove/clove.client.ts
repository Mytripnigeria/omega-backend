import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

/**
 * Thin HTTP client for the Cloove API (https://api.clooveai.com).
 *
 * Contract verified against the live API, not the published docs (which are
 * JS-rendered and expose no machine-readable spec):
 *   - everything lives under `/v1`; the bare paths 404
 *   - auth is `Bearer <api key>`
 *   - success  {success, message, data, meta}
 *   - failure  {error, message, details?[]}   (422 for validation)
 *   - money is in **naira decimals**, not kobo (unlike Chowdeck)
 *   - a real `User-Agent` is required: Cloudflare answers 1010 to default
 *     library agents, which reads as a puzzling 403
 *   - products carry **no external-reference field**, so the productId ↔
 *     cloveProductId map has to be kept on our side
 *   - the READ side is camelCase (`isActive`, `basePrice`) but the WRITE side
 *     is snake_case (`is_active`, `image_urls`, `store_inventory`). A camelCase
 *     field on a write is silently ignored — no error, no effect — which is
 *     why images, stock and active flags never "took" until this was found
 *     (docs.clooveai.com/products-api, confirmed against the live API)
 *   - `quantity` seeds stock on create only; on an update stock moves through
 *     `store_inventory` or per-variant `stock_quantity`
 *   - DELETE is a soft delete: the id never comes back — and the SKU stays
 *     reserved, so re-creating it anywhere answers a bare 500
 *   - rate limit: 120 calls per window (`x-ratelimit-limit`), 429 with a
 *     `Retry-After` beyond it
 */
export interface CloveCredentials {
  apiKey: string;
  baseUrl: string;
}

export interface CloveVariantInput {
  /** Existing Cloove variant id — keeps the id stable across an update. */
  id?: string;
  name: string;
  price: number;
  sku?: string;
  stock_quantity?: number;
}

export interface CloveProductInput {
  name: string;
  price: number;
  description?: string;
  unit?: string;
  /** Applied to the default variant only — ignored when `variants` is sent. */
  sku?: string;
  category_id?: string;
  is_active?: boolean;
  /** Public HTTPS URLs; the first becomes the primary image. */
  image_urls?: string[];
  /** Initial stock for the default variant — honoured on create only. */
  quantity?: number;
  /** Stock per Cloove store — the way stock moves on an update. */
  store_inventory?: Array<{ store_id: string; stock_quantity: number }>;
  /** When present this is the desired FINAL variant set, not an append. */
  variants?: CloveVariantInput[];
}

export interface CloveProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  unit: string | null;
  isActive: boolean;
  categoryId: string | null;
  /** Modifier-only items (extras) — not menu entries in their own right. */
  isExtraOnly?: boolean;
  images?: Array<{ id?: string; url: string; isPrimary?: boolean }>;
  stores?: Array<{ id: string; name?: string }>;
  variants?: Array<{
    id: string;
    name: string | null;
    sku: string | null;
    price: string;
  }>;
}

export interface CloveCategory {
  id: string;
  name: string;
  slug?: string | null;
}

export interface CloveOrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CloveOrder {
  id: string;
  shortCode: string | null;
  status: string;
  /**
   * `pending` (nothing collected) | `partial` | `paid`. Cloove computes it
   * from the totals: paid means `amountPaid >= totalAmount`. Only a paid
   * order is put on a counter — see CloveIngestService.isPaid.
   */
  paymentStatus: string | null;
  items?: CloveOrderItem[] | null;
  /** What the customer actually owes: lines − discount + delivery fee. */
  totalAmount?: number | string | null;
  /** The line total before discounts; equals the sum of the item lines. */
  subtotalAmount?: number | string | null;
  discountAmount?: number | string | null;
  /** A restaurant service charge — not delivery, and not ours to re-book. */
  serviceChargeAmount?: number | string | null;
  /** Extra order-level charges, when Cloove itemises them. */
  charges?: Array<{ name?: string | null; amount?: number | string | null }> | null;
  amountPaid?: number | string | null;
  remainingAmount?: number | string | null;
  /**
   * `dine_in` | `takeaway` | `room_service`, and **null on a delivery** —
   * Cloove's assistant has no delivery value, it records the address and the
   * fee in `notes` instead. See CloveIngestService.deliveryOf.
   */
  serviceMode?: string | null;
  /**
   * The order's kitchen ticket. Null when the order was never routed to the
   * kitchen on Cloove (created without `send_to_kitchen`), in which case
   * `POST /v1/orders/:id/kitchen-status` answers 404.
   */
  kitchenTicketId?: string | null;
  /** `queued` | `preparing` | `ready` | `served`, or null with no ticket. */
  kitchenTicketStatus?: string | null;
  currency?: string | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    phoneNumber?: string | null;
    whatsappNumber?: string | null;
    email?: string | null;
  } | null;
  store?: { id?: string; name?: string } | null;
  channel?: string | null;
  notes?: string | null;
  createdAt?: string;
  occurredAt?: string;
}

/** Per-call knobs; see CloveClient.request. */
interface CloveRequestOptions {
  /** Internal: which 429 retry this is. */
  attempt?: number;
  headers?: Record<string, string>;
  /** False for calls a person is waiting on — fail fast instead of waiting out the window. */
  retryOn429?: boolean;
  timeoutMs?: number;
}

/** The prep stages a Cloove kitchen ticket can hold. */
export type CloveKitchenStatus = 'queued' | 'preparing' | 'ready' | 'served';

/** What came back from Cloove's "Send to Kitchen". */
export interface CloveKitchenHandover {
  kitchenTicketId: string | null;
  kitchenTicketStatus: string | null;
  /** Whether Cloove messaged the customer, and why not when it did not. */
  notification: { status?: string; reason?: string } | null;
}

export interface ClovePage<T> {
  data: T[];
  meta?: { total?: number; page?: number; perPage?: number; hasMore?: boolean };
}

/**
 * Surfaces Cloove's own wording instead of a bare 500.
 *
 * The status matters more than it looks. A 502 is the honest code for "the
 * upstream broke", but nginx is routinely configured to intercept 5xx and
 * replace the body with its own error page — which strips the CORS headers, so
 * the browser cannot read the response and reports a bare **"load failed"**
 * with no message at all. That is exactly what a merchant saw after entering a
 * publishable key instead of a secret one: the real answer ("Invalid API key")
 * never reached them.
 *
 * So anything the merchant can actually fix — bad key, bad reference, rejected
 * payload — comes back as 4xx and keeps its message. 502 is reserved for
 * genuine upstream outages.
 */
export class CloveApiError extends HttpException {
  readonly upstreamStatus: number;

  constructor(message: string, upstreamStatus: number) {
    const clientFixable = [400, 401, 403, 404, 409, 422].includes(upstreamStatus);
    super(
      `Cloove: ${message}`,
      upstreamStatus === 429
        ? HttpStatus.TOO_MANY_REQUESTS
        : clientFixable
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.BAD_GATEWAY,
    );
    this.upstreamStatus = upstreamStatus;
  }
}

@Injectable()
export class CloveClient {
  private readonly logger = new Logger(CloveClient.name);

  /** Tries per call when Cloove answers 429 — a publish is ~80 calls. */
  private static readonly MAX_ATTEMPTS = 3;

  /** Nothing waits on Cloove longer than this; Cloove answers in ~0.7 s. */
  static readonly DEFAULT_TIMEOUT_MS = 20_000;
  /** A cashier is watching this one, so it fails fast instead of hanging. */
  static readonly INTERACTIVE_TIMEOUT_MS = 10_000;

  /**
   * `AbortSignal.timeout` where the runtime has it (Node 18+), and nothing
   * where it does not — an older runtime loses the timeout, not the call.
   */
  private static timeoutSignal(ms: number): AbortSignal | undefined {
    const factory = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout;
    return typeof factory === 'function' ? factory.call(AbortSignal, ms) : undefined;
  }

  /**
   * How long to wait before attempt N+1 after a 429. Cloove's window is a
   * minute and its `Retry-After` is usually absent (`meta.retryAfter: null`),
   * so the fallback climbs to cover a full window: 15 s, then 30 s.
   */
  static retryDelaySeconds(retryAfterHeader: string | null, attempt: number): number {
    if (retryAfterHeader !== null && Number.isFinite(Number(retryAfterHeader))) {
      return Math.min(Math.max(Number(retryAfterHeader), 0), 45);
    }
    return [15, 30][attempt - 1] ?? 30;
  }

  private async request<T>(
    creds: CloveCredentials,
    method: string,
    path: string,
    body?: unknown,
    opts: CloveRequestOptions = {},
  ): Promise<T> {
    const attempt = opts.attempt ?? 1;
    const base = (creds.baseUrl || 'https://api.clooveai.com').replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Required: Cloove sits behind Cloudflare, which rejects default
          // library user agents with error 1010 (a confusing 403).
          'User-Agent': 'OmegaOS/1.0 (+https://app.omega.com.ng)',
          ...(opts.headers ?? {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        // Nothing may hang: a status push runs inside a cashier's button
        // press, and an unanswered socket would otherwise hold the POS (and a
        // request thread) until the proxy gave up.
        signal: CloveClient.timeoutSignal(opts.timeoutMs ?? CloveClient.DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError' || (err as Error)?.name === 'TimeoutError';
      throw new CloveApiError(
        aborted ? 'Cloove did not answer in time' : `Could not reach Cloove: ${(err as Error).message}`,
        aborted ? 504 : 502,
      );
    }

    // A publish is ~64 calls and must survive brushing the limit, so it waits
    // and tries again. An interactive status push does not: 15 s then 30 s of
    // silence under a cashier's finger is worse than a clear "try again".
    if (res.status === 429 && opts.retryOn429 !== false && attempt < CloveClient.MAX_ATTEMPTS) {
      const seconds = CloveClient.retryDelaySeconds(res.headers.get('retry-after'), attempt);
      this.logger.warn(
        `${method} ${path} -> 429, retrying in ${seconds}s (attempt ${attempt}/${CloveClient.MAX_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return this.request<T>(creds, method, path, body, { ...opts, attempt: attempt + 1 });
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { message: text };
    }
    const payload = parsed as {
      success?: boolean;
      message?: string;
      error?: string;
      details?: Array<{ field?: string; message?: string }>;
      data?: unknown;
      meta?: unknown;
    };

    if (!res.ok || payload.success === false) {
      const detail = (payload.details ?? [])
        .map((d) => d.message)
        .filter(Boolean)
        .join('; ');
      let message = detail || payload.message || payload.error || `HTTP ${res.status}`;
      if (res.status === 429) {
        message = `${message} Cloove allows 120 calls a minute — try again in a minute.`;
      }
      if (res.status === 401 || res.status === 403) {
        // Name the most common cause outright: Cloove issues both a
        // publishable key (clv_live_pk_…) and a secret key (clv_live_sk_…),
        // and only the secret one works against this API.
        message =
          `${message}. Check you used the SECRET key (clv_live_sk_…) — a ` +
          `publishable key (clv_live_pk_…) is rejected by the Cloove API.`;
      }
      this.logger.warn(
        `${method} ${path} -> ${res.status}: ${message} · body: ${text.slice(0, 300)}`,
      );
      throw new CloveApiError(message, res.status);
    }
    return payload as T;
  }

  async listProducts(
    creds: CloveCredentials,
    page = 1,
    limit = 100,
  ): Promise<ClovePage<CloveProduct>> {
    return this.request<ClovePage<CloveProduct>>(
      creds,
      'GET',
      `/v1/products?page=${page}&limit=${limit}`,
    );
  }

  /** Every page of the catalogue, so the id map covers the whole menu. */
  async listAllProducts(creds: CloveCredentials): Promise<CloveProduct[]> {
    const all: CloveProduct[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const res = await this.listProducts(creds, page, 100);
      all.push(...(res.data ?? []));
      if (!res.meta?.hasMore) break;
    }
    return all;
  }

  async createProduct(
    creds: CloveCredentials,
    input: CloveProductInput,
  ): Promise<CloveProduct> {
    const res = await this.request<{ data: CloveProduct }>(
      creds,
      'POST',
      '/v1/products',
      input,
    );
    return res.data;
  }

  async updateProduct(
    creds: CloveCredentials,
    cloveProductId: string,
    input: Partial<CloveProductInput>,
  ): Promise<CloveProduct> {
    const res = await this.request<{ data: CloveProduct }>(
      creds,
      'PATCH',
      `/v1/products/${cloveProductId}`,
      input,
    );
    return res.data;
  }

  /** Business-wide categories; a product without one shows as "General". */
  async listCategories(creds: CloveCredentials): Promise<CloveCategory[]> {
    const res = await this.request<{ data: CloveCategory[] }>(
      creds,
      'GET',
      '/v1/products/categories',
    );
    return res.data ?? [];
  }

  async createCategory(creds: CloveCredentials, name: string): Promise<CloveCategory> {
    const res = await this.request<{ data: CloveCategory }>(
      creds,
      'POST',
      '/v1/products/categories',
      { name },
    );
    return res.data;
  }

  /** One product as Cloove holds it now, or null when it is gone. */
  async getProduct(
    creds: CloveCredentials,
    cloveProductId: string,
  ): Promise<CloveProduct | null> {
    try {
      const res = await this.request<{ data: CloveProduct }>(
        creds,
        'GET',
        `/v1/products/${cloveProductId}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async deleteProduct(creds: CloveCredentials, cloveProductId: string): Promise<void> {
    await this.request(creds, 'DELETE', `/v1/products/${cloveProductId}`);
  }

  async listOrders(
    creds: CloveCredentials,
    page = 1,
    limit = 50,
  ): Promise<ClovePage<CloveOrder>> {
    return this.request<ClovePage<CloveOrder>>(
      creds,
      'GET',
      `/v1/orders?page=${page}&limit=${limit}`,
    );
  }

  async getOrder(creds: CloveCredentials, orderId: string): Promise<CloveOrder | null> {
    try {
      const res = await this.request<{ data: CloveOrder }>(
        creds,
        'GET',
        `/v1/orders/${orderId}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * The ORDER status. Cloove accepts only `scheduled`, `pending`, `completed`
   * and `cancelled` here — anything else comes back 422 "The selected status
   * is invalid". Prep stages live on the kitchen ticket instead; see
   * `updateKitchenStatus`.
   */
  async updateOrderStatus(
    creds: CloveCredentials,
    cloveOrderId: string,
    status: string,
    cancellationReason?: string,
  ): Promise<void> {
    await this.request(
      creds,
      'PATCH',
      `/v1/orders/${cloveOrderId}`,
      {
        status,
        ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}),
      },
      // Staff are waiting on this one (Reject at the counter).
      { retryOn429: false, timeoutMs: CloveClient.INTERACTIVE_TIMEOUT_MS },
    );
  }

  /**
   * Creates the order's kitchen ticket — Cloove's own "Send to Kitchen", which
   * they shipped on 2026-09-21 for exactly this case.
   *
   * Their assistant records orders with `send_to_kitchen: false` (the order is
   * booked immediately so payment can be chased, but prep must not start until
   * the money clears), which left those orders with no ticket and nothing our
   * POS could move. This is the trigger that creates one, and it sends the
   * customer the initial-stage WhatsApp message.
   *
   * `409` means the order already has a ticket — nothing is wrong, the stage
   * endpoint simply takes over from there.
   */
  async sendOrderToKitchen(
    creds: CloveCredentials,
    cloveOrderId: string,
    idempotencyKey?: string,
  ): Promise<CloveKitchenHandover> {
    const res = await this.request<{
      data?: CloveOrder;
      meta?: { notification?: { status?: string; reason?: string } };
    }>(
      creds,
      'POST',
      `/v1/orders/${cloveOrderId}/send-to-kitchen`,
      undefined,
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        retryOn429: false,
        timeoutMs: CloveClient.INTERACTIVE_TIMEOUT_MS,
      },
    );
    return {
      kitchenTicketId: res.data?.kitchenTicketId ?? null,
      kitchenTicketStatus: res.data?.kitchenTicketStatus ?? null,
      notification: res.meta?.notification ?? null,
    };
  }

  /**
   * Moves the order's KITCHEN TICKET to a prep stage — the same transition
   * Cloove's own Kitchen board makes, so the customer gets the WhatsApp stage
   * message the business configured and a `kitchen_ticket.status_updated`
   * event fires (docs.clooveai.com/orders-api, "Update kitchen status").
   *
   * Stages are not ordered: a ticket may move forward or back to any stage,
   * which is what the workstation's "Call back" needs. Repeating the current
   * stage is a safe 200 that sends nothing, and the `Idempotency-Key` makes a
   * retried request return the original response instead of messaging the
   * customer twice.
   *
   * 404 "This order has no associated kitchen ticket" means the order was
   * created on Cloove without `send_to_kitchen`; there is no API that adds a
   * ticket afterwards, so nothing in our payload can fix it.
   */
  async updateKitchenStatus(
    creds: CloveCredentials,
    cloveOrderId: string,
    status: CloveKitchenStatus,
    idempotencyKey?: string,
  ): Promise<void> {
    await this.request(
      creds,
      'POST',
      `/v1/orders/${cloveOrderId}/kitchen-status`,
      { status },
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        // A cook is holding the screen: fail fast rather than wait out a
        // rate-limit window under their finger.
        retryOn429: false,
        timeoutMs: CloveClient.INTERACTIVE_TIMEOUT_MS,
      },
    );
  }

  /** Cheap authenticated call behind "Test connection". */
  async ping(creds: CloveCredentials): Promise<{ products: number }> {
    const res = await this.listProducts(creds, 1, 1);
    return { products: res.meta?.total ?? (res.data ?? []).length };
  }
}
