import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CloveIngestService } from './clove-ingest.service';

/**
 * Cloove's webhook receiver, at the path the client registered with them:
 * `https://app.omega.com.ng/webhook/cloveai`. Outside `/api` guards because
 * Cloove posts unauthenticated.
 *
 * The posted body is treated as a *hint*, never as truth: it only tells us
 * which order to look at, and the order is then read back from Cloove with our
 * own key before anything is written. A forged post therefore achieves nothing
 * — the same callback-verification rule the Chowdeck receiver uses.
 *
 * Typed as a plain interface, not a class DTO: the global ValidationPipe runs
 * `forbidNonWhitelisted` and would 400 on every Cloove field we don't declare.
 */
export interface CloveWebhookBody {
  event?: string;
  type?: string;
  data?: { id?: string; orderId?: string; order?: { id?: string } };
  orderId?: string;
  id?: string;
  [key: string]: unknown;
}

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
