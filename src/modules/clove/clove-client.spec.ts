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

    expect((err as CloveApiError).message).toMatch(/publish again in a minute/);
  });
});
