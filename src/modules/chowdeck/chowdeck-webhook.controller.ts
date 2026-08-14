import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChowdeckIngestService } from './chowdeck-ingest.service';
import { ChowdeckWebhookBody } from './dto/chowdeck-integration.dto';

/**
 * Chowdeck's webhook receiver — deliberately outside `/api` guards, since
 * Chowdeck posts unauthenticated.
 *
 * The bare path is the one in Chowdeck's own docs
 * (`https://app.omega.com.ng/webhook/chowdeck`); the `:token` variant lets a
 * merchant pin the endpoint to one store. Either way the payload is proved by
 * fetching the order back from Chowdeck before anything is written — see
 * ChowdeckIngestService.
 *
 * The body is typed as a plain interface on purpose: the global ValidationPipe
 * runs with `forbidNonWhitelisted`, and a class DTO would 400 on every field
 * of Chowdeck's payload that we don't declare.
 */
@ApiExcludeController()
@Controller('webhook/chowdeck')
export class ChowdeckWebhookController {
  constructor(private readonly ingest: ChowdeckIngestService) {}

  // Generous but finite: Chowdeck retries, and this endpoint is unauthenticated.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() body: ChowdeckWebhookBody) {
    return this.ingest.handle(body);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post(':token')
  @HttpCode(HttpStatus.OK)
  receiveWithToken(
    @Param('token') token: string,
    @Body() body: ChowdeckWebhookBody,
  ) {
    return this.ingest.handle(body, token);
  }
}
