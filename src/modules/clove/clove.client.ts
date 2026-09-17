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
  paymentStatus: string | null;
  items?: CloveOrderItem[] | null;
  totalAmount?: number | string | null;
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
    attempt = 1,
  ): Promise<T> {
    const base = (creds.baseUrl || 'https://api.clooveai.com').replace(/\/+$/, '');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Required: Cloove sits behind Cloudflare, which rejects default
        // library user agents with error 1010 (a confusing 403).
        'User-Agent': 'OmegaOS/1.0 (+https://app.omega.com.ng)',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 429 && attempt < CloveClient.MAX_ATTEMPTS) {
      // 120 calls per window; Cloove says how long to wait. Waiting here,
      // inside the call, keeps a publish that brushes the limit correct
      // rather than half-done.
      const seconds = CloveClient.retryDelaySeconds(res.headers.get('retry-after'), attempt);
      this.logger.warn(
        `${method} ${path} -> 429, retrying in ${seconds}s (attempt ${attempt}/${CloveClient.MAX_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return this.request<T>(creds, method, path, body, attempt + 1);
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
        message = `${message} Cloove allows 120 calls a minute — publish again in a minute.`;
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
   * Cloove accepts only `pending`, `completed` and `cancelled` — anything else
   * comes back 422 "The selected status is invalid".
   */
  async updateOrderStatus(
    creds: CloveCredentials,
    cloveOrderId: string,
    status: string,
  ): Promise<void> {
    await this.request(creds, 'PATCH', `/v1/orders/${cloveOrderId}`, { status });
  }

  /** Cheap authenticated call behind "Test connection". */
  async ping(creds: CloveCredentials): Promise<{ products: number }> {
    const res = await this.listProducts(creds, 1, 1);
    return { products: res.meta?.total ?? (res.data ?? []).length };
  }
}
