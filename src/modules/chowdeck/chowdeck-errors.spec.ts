import { HttpStatus } from '@nestjs/common';
import { ChowdeckApiError } from './chowdeck.client';

/**
 * Production, round-11 re-test: "Publish menu" and "Test connection" both
 * showed "Could not reach the server". The server had answered instantly —
 * Chowdeck said 401 "Invalid permissions" (the merchant's key had been
 * revoked) — but every Chowdeck error went back as 502, the edge replaced the
 * body and dropped the CORS headers, and the browser saw a network failure.
 */
describe('ChowdeckApiError', () => {
  it('returns a Chowdeck 4xx as 400 so the reason reaches the merchant', () => {
    const err = new ChowdeckApiError('Invalid permissions', 401, {});
    expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(err.message).toBe('Chowdeck: Invalid permissions');
  });

  it.each([400, 403, 404, 422])('maps upstream %i to 400', (status) => {
    expect(new ChowdeckApiError('nope', status, null).getStatus()).toBe(
      HttpStatus.BAD_REQUEST,
    );
  });

  it('keeps a genuine Chowdeck outage as 502', () => {
    expect(new ChowdeckApiError('boom', 500, null).getStatus()).toBe(
      HttpStatus.BAD_GATEWAY,
    );
    expect(new ChowdeckApiError('gateway', 503, null).getStatus()).toBe(
      HttpStatus.BAD_GATEWAY,
    );
  });

  it('still recognises a not-found probe', () => {
    expect(new ChowdeckApiError('Order not found', 404, null).isNotFound).toBe(true);
  });
});
