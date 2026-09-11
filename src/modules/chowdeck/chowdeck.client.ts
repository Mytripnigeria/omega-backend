import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

/**
 * Thin HTTP client for the Chowdeck merchant API.
 *
 * Contract notes, all confirmed against the live sandbox rather than the
 * published Postman collection (which is wrong in two places):
 *
 *  - The base path is `/merchant/{merchantReference}`. The collection renders
 *    it as `https://api.chowdeck.com//:merchantReference/...` — the `merchant`
 *    segment is missing, and that URL 404s.
 *  - `PUT .../reject` requires a `reason`; without one it answers
 *    `{"status":"failed","message":"Please pass reason"}`.
 *  - Failures come back as **HTTP 400** with `{status:"failed", message}`, not
 *    4xx-per-meaning. A bad key is `401 {"message":"Invalid Key"}`.
 *  - All money is in **kobo**.
 */

/** Chowdeck's success envelope. */
interface ChowdeckEnvelope<T> {
  status: 'success' | 'failed' | string;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface ChowdeckCredentials {
  merchantReference: string;
  secretKey: string;
  /** Defaults to https://api.chowdeck.com */
  baseUrl?: string;
}

export interface ChowdeckOrderItem {
  id: number;
  quantity: number;
  price_per_quantity: number;
  description: string | null;
}

export interface ChowdeckCustomer {
  id?: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country_code?: string | null;
}

export interface ChowdeckAddress {
  id?: number;
  street?: string | null;
  pretty_name?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  coordinate?: { x: number; y: number } | null;
}

/**
 * Chowdeck's rider. Their docs only ever show `"driver": {}` — never a
 * populated example — so the field names are unknown until a real assignment
 * arrives. Read it loosely and pick out whatever contact details are present
 * rather than hard-coding a shape that may not match.
 */
export interface ChowdeckDriver {
  id?: number | string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  [key: string]: unknown;
}

export interface ChowdeckOrder {
  id: number;
  reference: string;
  status: string;
  total_price: number;
  delivery_price?: number;
  currency?: string;
  summary?: string | null;
  source?: string | null;
  class?: string | null;
  created_at?: string;
  customer?: ChowdeckCustomer | null;
  items?: ChowdeckOrderItem[] | null;
  customer_address?: ChowdeckAddress | null;
  vendor_address?: ChowdeckAddress | null;
  vendor_information?: { name?: string } | null;
  /** Populated once Chowdeck assigns a rider; `{}` before that. */
  driver?: ChowdeckDriver | null;
}

export interface ChowdeckBulkUpdateResult {
  results: Array<{
    reference: string;
    status: 'success' | 'failed' | string;
    message?: string;
  }>;
  summary?: { success_count?: number; failure_count?: number };
}

export interface ChowdeckMenuItem {
  id: number;
  name: string;
  reference: string | null;
  price: number;
  in_stock: boolean;
}

/**
 * A non-2xx or `status: "failed"` response from Chowdeck.
 *
 * Extends HttpException so an unhandled one surfaces to the merchant as a 502
 * carrying Chowdeck's own wording ("Invalid Key", "Order not found") instead of
 * a bare 500 — while still being catchable by type where we probe.
 */
export class ChowdeckApiError extends HttpException {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly body: unknown,
  ) {
    super(`Chowdeck: ${message}`, HttpStatus.BAD_GATEWAY);
    this.name = 'ChowdeckApiError';
  }

  /**
   * True when Chowdeck is telling us the order simply isn't theirs / doesn't
   * exist. Used to probe which configured merchant owns an incoming webhook.
   */
  get isNotFound(): boolean {
    return /not found/i.test(this.message);
  }
}

@Injectable()
export class ChowdeckClient {
  private readonly logger = new Logger(ChowdeckClient.name);
  private static readonly DEFAULT_BASE_URL = 'https://api.chowdeck.com';
  private static readonly TIMEOUT_MS = 15_000;

  private endpoint(creds: ChowdeckCredentials, path: string): string {
    const base = (creds.baseUrl || ChowdeckClient.DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    return `${base}/merchant/${encodeURIComponent(creds.merchantReference)}${path}`;
  }

  private async request<T>(
    creds: ChowdeckCredentials,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = this.endpoint(creds, path);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      ChowdeckClient.TIMEOUT_MS,
    );

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (err) {
      const reason =
        (err as Error).name === 'AbortError'
          ? `timed out after ${ChowdeckClient.TIMEOUT_MS}ms`
          : (err as Error).message;
      throw new BadGatewayException(`Chowdeck request failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: ChowdeckEnvelope<T> | { message?: string } | undefined;
    try {
      parsed = text ? (JSON.parse(text) as ChowdeckEnvelope<T>) : undefined;
    } catch {
      parsed = undefined;
    }

    const message =
      (parsed as { message?: string } | undefined)?.message ??
      `HTTP ${res.status}`;

    // Chowdeck signals business failures with 400 + status:"failed", and an
    // invalid key with 401 — neither is distinguishable by status code alone.
    if (!res.ok || (parsed as ChowdeckEnvelope<T>)?.status === 'failed') {
      throw new ChowdeckApiError(message, res.status, parsed ?? text);
    }

    return (parsed as ChowdeckEnvelope<T>)?.data as T;
  }

  /** Authoritative order record. Also used to prove an incoming webhook is real. */
  getOrder(
    creds: ChowdeckCredentials,
    reference: string,
  ): Promise<ChowdeckOrder> {
    return this.request<ChowdeckOrder>(
      creds,
      'GET',
      `/order/${encodeURIComponent(reference)}`,
    );
  }

  /** Merchant has taken the order on. */
  acceptOrder(creds: ChowdeckCredentials, reference: string): Promise<unknown> {
    return this.request(
      creds,
      'PUT',
      `/order/${encodeURIComponent(reference)}/accept`,
    );
  }

  /** Merchant can't fulfil it. `reason` is mandatory on Chowdeck's side. */
  rejectOrder(
    creds: ChowdeckCredentials,
    reference: string,
    reason: string,
  ): Promise<unknown> {
    return this.request(
      creds,
      'PUT',
      `/order/${encodeURIComponent(reference)}/reject`,
      { reason: reason?.trim() || 'Unable to fulfil this order' },
    );
  }

  /** Food is packed and waiting for the rider. */
  readyOrder(creds: ChowdeckCredentials, reference: string): Promise<unknown> {
    return this.request(
      creds,
      'PUT',
      `/order/${encodeURIComponent(reference)}/ready`,
    );
  }

  /**
   * The merchant's live menu on Chowdeck. This is how we learn the numeric
   * `id` for each of our products: webhooks identify ordered items by that id,
   * never by the `reference` we upload.
   */
  listMenu(creds: ChowdeckCredentials): Promise<ChowdeckMenuItem[]> {
    return this.request<ChowdeckMenuItem[]>(creds, 'GET', '/menu');
  }

  /** Creates menu items in bulk; returns the references it accepted. */
  bulkUploadMenu(
    creds: ChowdeckCredentials,
    items: unknown[],
  ): Promise<string[]> {
    return this.request<string[]>(creds, 'POST', '/menu/bulk-upload', {
      items,
    });
  }

  /**
   * Updates existing menu items, matched on the `reference` we uploaded.
   *
   * Note the response semantics: this answers **HTTP 200 with
   * `status: "success"` even when individual items fail**, reporting each one
   * under `results`. Callers must read `summary`/`results` rather than treat a
   * 2xx as "everything worked".
   */
  bulkUpdateMenu(
    creds: ChowdeckCredentials,
    items: unknown[],
  ): Promise<ChowdeckBulkUpdateResult> {
    return this.request<ChowdeckBulkUpdateResult>(
      creds,
      'PUT',
      '/menu/bulk-update',
      { items },
    );
  }

  /** Cheap authenticated call used by "Test connection". */
  async ping(creds: ChowdeckCredentials): Promise<{ menuItems: number }> {
    const menu = await this.listMenu(creds);
    return { menuItems: Array.isArray(menu) ? menu.length : 0 };
  }
}
