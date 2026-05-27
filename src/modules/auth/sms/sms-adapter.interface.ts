/**
 * Pluggable SMS sender. Implementations should fail soft — return false (or
 * throw a `SmsDeliveryError`) so the auth flow can decide whether to expose the
 * failure to the caller or quietly retry on the next request.
 */
export interface SmsAdapter {
  /**
   * Sends an SMS to the destination phone (E.164 format). Returns true if the
   * provider accepted the message for delivery.
   */
  send(to: string, body: string): Promise<boolean>;

  /** Provider name, for diagnostics / logs. */
  readonly name: string;
}

export const SMS_ADAPTER = Symbol('SMS_ADAPTER');
