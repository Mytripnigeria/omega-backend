import { CloveApiError, CloveClient } from './clove.client';

/**
 * Live finding during the round-11 Cloove re-test: two publishes back to back
 * crossed Cloove's 120-calls-per-window limit and eleven products came back
 * "Too many requests" — half a menu, silently. The client waits the time
 * Cloove asks for and tries again, so a publish that brushes the limit is
 * slower, not half-done.
 */
describe('CloveClient rate limiting', () => {
  const creds = { apiKey: 'sk', baseUrl: 'https://cloove.test' };
  const response = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
    ok: status < 400,
    status,
    headers: new Headers(headers),
    text: async () => JSON.stringify(body),
  });
  const limited = () =>
    response(429, { error: 'rate_limited', message: 'Too many requests. Retry after the indicated delay.' }, { 'retry-after': '0' });

  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it('waits for Retry-After and tries again on 429', async () => {
    fetchMock
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(response(200, { success: true, data: [], meta: { total: 0 } }));

    const res = await new CloveClient().listProducts(creds);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.meta?.total).toBe(0);
  });

  it('gives up after three attempts and reports 429, not a gateway error', async () => {
    fetchMock.mockResolvedValue(limited());

    const err = await new CloveClient().listProducts(creds).catch((e: CloveApiError) => e);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(CloveApiError);
    expect((err as CloveApiError).upstreamStatus).toBe(429);
    expect((err as CloveApiError).getStatus()).toBe(429);
    expect((err as CloveApiError).message).toMatch(/Too many requests/);
  });

  it('does not retry anything but 429', async () => {
    fetchMock.mockResolvedValue(response(500, { error: 'internal_error', message: 'An unexpected error occurred.' }));

    await expect(new CloveClient().listProducts(creds)).rejects.toThrow(/unexpected error/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('backs off 15 s then 30 s when Cloove sends no Retry-After, and obeys one when it does', () => {
    expect(CloveClient.retryDelaySeconds(null, 1)).toBe(15);
    expect(CloveClient.retryDelaySeconds(null, 2)).toBe(30);
    expect(CloveClient.retryDelaySeconds('7', 1)).toBe(7);
    expect(CloveClient.retryDelaySeconds('600', 1)).toBe(45);
    expect(CloveClient.retryDelaySeconds('0', 2)).toBe(0);
  });

  it('tells the merchant what a 429 means', async () => {
    fetchMock.mockResolvedValue(limited());

    const err = await new CloveClient().listProducts(creds).catch((e: CloveApiError) => e);

    expect((err as CloveApiError).message).toMatch(/try again in a minute/);
  });
});

/**
 * The kitchen-status endpoint Cloove added for exactly this flow: it moves the
 * order's kitchen ticket through the stages its own Kitchen board uses, which
 * is what lets our POS drive it (docs.clooveai.com/orders-api).
 */
describe('CloveClient.updateKitchenStatus', () => {
  const creds = { apiKey: 'sk', baseUrl: 'https://cloove.test' };
  const ok = () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ message: 'Kitchen status updated', data: { id: 'ord-1', kitchenTicketStatus: 'preparing' } }),
  });

  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it('posts the stage to the order kitchen-status endpoint', async () => {
    fetchMock.mockResolvedValue(ok());

    await new CloveClient().updateKitchenStatus(creds, 'ord-1', 'preparing');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloove.test/v1/orders/ord-1/kitchen-status');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ status: 'preparing' });
  });

  it('carries an idempotency key so a retry cannot message the customer twice', async () => {
    fetchMock.mockResolvedValue(ok());

    await new CloveClient().updateKitchenStatus(creds, 'ord-1', 'ready', 'key-1');

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('key-1');
  });

  it('keeps Cloove wording when the order has no kitchen ticket', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => JSON.stringify({ error: 'not_found', message: 'This order has no associated kitchen ticket' }),
    });

    const err = await new CloveClient()
      .updateKitchenStatus(creds, 'ord-1', 'queued')
      .catch((e: CloveApiError) => e);

    expect((err as CloveApiError).upstreamStatus).toBe(404);
    expect((err as CloveApiError).message).toMatch(/no associated kitchen ticket/);
  });

  it('sends a cancellation reason with an order cancellation', async () => {
    fetchMock.mockResolvedValue(ok());

    await new CloveClient().updateOrderStatus(creds, 'ord-1', 'cancelled', 'Out of stock');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloove.test/v1/orders/ord-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'cancelled', cancellation_reason: 'Out of stock' });
  });
});

/**
 * Status pushes now run inside a cashier's button press (Cloove first, then
 * us), so they must fail fast instead of waiting out a rate-limit window or an
 * unanswered socket while someone holds the screen.
 */
describe('CloveClient — calls a person is waiting on', () => {
  const creds = { apiKey: 'sk', baseUrl: 'https://cloove.test' };
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it('does not sit on a 429 for a kitchen stage', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
      text: async () => JSON.stringify({ error: 'rate_limited', message: 'Too many requests.' }),
    });

    const err = await new CloveClient()
      .updateKitchenStatus(creds, 'ord-1', 'ready')
      .catch((e: CloveApiError) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((err as CloveApiError).upstreamStatus).toBe(429);
  });

  it('gives the call a deadline', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), text: async () => '{}' });

    await new CloveClient().updateKitchenStatus(creds, 'ord-1', 'ready');

    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  it('turns an unreachable Cloove into an error the POS can show', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const err = await new CloveClient()
      .updateKitchenStatus(creds, 'ord-1', 'ready')
      .catch((e: CloveApiError) => e);

    expect(err).toBeInstanceOf(CloveApiError);
    expect((err as CloveApiError).message).toMatch(/Could not reach Cloove/);
  });

  it('says so when Cloove does not answer in time', async () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'TimeoutError';
    fetchMock.mockRejectedValue(abort);

    const err = await new CloveClient()
      .updateKitchenStatus(creds, 'ord-1', 'ready')
      .catch((e: CloveApiError) => e);

    expect((err as CloveApiError).message).toMatch(/did not answer in time/);
    expect((err as CloveApiError).upstreamStatus).toBe(504);
  });
});
