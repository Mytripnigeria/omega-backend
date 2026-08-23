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
 */
export interface CloveCredentials {
  apiKey: string;
  baseUrl: string;
}

export interface CloveVariantInput {
  name: string;
  price: number;
  sku?: string;
}

export interface CloveProductInput {
  name: string;
  price: number;
  description?: string;
  unit?: string;
  sku?: string;
  categoryId?: string;
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
  variants?: Array<{
    id: string;
    name: string | null;
    sku: string | null;
    price: string;
  }>;
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
  customer?: { name?: string | null; phoneNumber?: string | null } | null;
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

/** Surfaces Cloove's own wording instead of a bare 500. */
export class CloveApiError extends HttpException {
  readonly upstreamStatus: number;

  constructor(message: string, upstreamStatus: number) {
    super(`Cloove: ${message}`, HttpStatus.BAD_GATEWAY);
    this.upstreamStatus = upstreamStatus;
  }
}

@Injectable()
export class CloveClient {
  private readonly logger = new Logger(CloveClient.name);

  private async request<T>(
    creds: CloveCredentials,
    method: string,
    path: string,
    body?: unknown,
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
      const message = detail || payload.message || payload.error || `HTTP ${res.status}`;
      this.logger.warn(`${method} ${path} -> ${res.status}: ${message}`);
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
