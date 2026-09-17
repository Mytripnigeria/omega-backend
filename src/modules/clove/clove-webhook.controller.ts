import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CloveEventBody, CloveIngestService } from './clove-ingest.service';

/**
 * Cloove's webhook receiver. The merchant registers
 * `<PUBLIC_URL>/webhook/cloveai/<channel id>` in Cloove's developer portal
 * (events `order.created` and `order.updated`); the hub shows that URL on the
 * channel. Outside `/api` guards because Cloove posts unauthenticated.
 *
 * Cloove signs deliveries (`Cloove-Signature: t=…,v1=…`, HMAC-SHA256 with a
 * `whsec_` secret). The signature is deliberately NOT what protects this
 * endpoint — see below — so the merchant has nothing to paste but the URL.
 *
 * The posted body is treated as a *hint*, never as truth: it only tells us
 * which order to look at, and the order is then read back from Cloove with our
 * own key before anything is written. A forged post therefore achieves nothing
 * — the same callback-verification rule the Chowdeck receiver uses.
 *
 * Typed as a plain interface, not a class DTO: the global ValidationPipe runs
 * `forbidNonWhitelisted` and would 400 on every Cloove field we don't declare.
 */
export type CloveWebhookBody = CloveEventBody;

@ApiExcludeController()
@Controller('webhook/cloveai')
export class CloveWebhookController {
  constructor(private readonly ingest: CloveIngestService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() body: CloveWebhookBody) {
    return this.ingest.handleWebhook(body);
  }

  /** Token variant, to pin the endpoint to one channel. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post(':token')
  @HttpCode(HttpStatus.OK)
  receiveWithToken(
    @Param('token') token: string,
    @Body() body: CloveWebhookBody,
  ) {
    return this.ingest.handleWebhook(body, token);
  }
}
