import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { CloveService } from './clove.service';
import { CloveIngestService } from './clove-ingest.service';
import { UpsertCloveIntegrationDto } from './dto/clove-integration.dto';

/**
 * Cloove omnichannel. Merchant-dashboard only — the workstation never talks to
 * Cloove directly; it just sees the orders this pulls in.
 */
@ApiTags('integrations/clove')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/clove')
export class CloveController {
  constructor(
    private readonly service: CloveService,
    private readonly ingest: CloveIngestService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({
    summary: "Every Cloove channel on a store",
    description:
      'Each channel carries the webhook URL to register in Cloove\'s developer ' +
      'portal (events order.created and order.updated).',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Get(':storeId/channels')
  async channels(
    @Req() req: Request,
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
  ) {
    const rows = await this.service.listChannels(businessId, storeId);
    return rows.map((c) => ({ ...c, webhookUrl: this.webhookUrl(req, c.id) }));
  }

  @ApiOperation({ summary: 'Connect a Cloove channel to a store' })
  @Post(':storeId/channels')
  async addChannel(
    @Req() req: Request,
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertCloveIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(businessId, storeId, {
      ...dto,
      createNew: true,
    });
    return { ...saved, webhookUrl: this.webhookUrl(req, saved.id) };
  }

  @ApiOperation({ summary: 'Update one Cloove channel' })
  @Put(':storeId/channels/:channelId')
  async updateChannel(
    @Req() req: Request,
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpsertCloveIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(businessId, storeId, dto, channelId);
    return { ...saved, webhookUrl: this.webhookUrl(req, saved.id) };
  }

  @ApiOperation({ summary: 'Check the API key works' })
  @ApiOkResponse({ schema: { example: { ok: true, products: 47 } } })
  @Post(':storeId/channels/:channelId/test')
  @HttpCode(HttpStatus.OK)
  test(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.testConnection(businessId, storeId, channelId);
  }

  @ApiOperation({
    summary: 'Publish the store menu to Cloove',
    description:
      'Creates products Cloove has not seen and corrects the ones it has, ' +
      'keyed by our own id map (Cloove products carry no external reference). ' +
      'Variations are published as Cloove variants.',
  })
  @Post(':storeId/channels/:channelId/sync-menu')
  @HttpCode(HttpStatus.OK)
  syncMenu(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.syncMenu(businessId, storeId, channelId);
  }

  @ApiOperation({
    summary: 'Publish a single product to Cloove',
    description:
      'The one-product smoke test: proves the credentials, the payload and ' +
      'the id map end to end without touching the rest of the catalogue.',
  })
  @Post(':storeId/channels/:channelId/publish/:productId')
  @HttpCode(HttpStatus.OK)
  publishOne(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
    @Param('productId') productId: string,
  ) {
    return this.service.syncOneProduct(businessId, storeId, productId, channelId);
  }

  @ApiOperation({
    summary: 'Pull recent Cloove orders into the POS',
    description:
      'Cloove is polled rather than pushed — we hold the key, so nothing has ' +
      'to be configured on their side. Idempotent: re-pulling the same page ' +
      'never creates a second order.',
  })
  @Post(':storeId/channels/:channelId/pull-orders')
  @HttpCode(HttpStatus.OK)
  async pullOrders(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
    @Query('limit') limit?: string,
  ) {
    const integration = await this.service.requireChannel(
      businessId,
      storeId,
      channelId,
    );
    return this.ingest.pullOrders(integration, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiOperation({
    summary: 'Send a test order through this channel',
    description:
      'Injects a realistic order through the same path a pulled Cloove order ' +
      'takes, so the workstation flow can be rehearsed before going live.',
  })
  @Post(':storeId/channels/:channelId/test-order')
  @HttpCode(HttpStatus.OK)
  async testOrder(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    const integration = await this.service.requireChannel(
      businessId,
      storeId,
      channelId,
    );
    return this.ingest.simulateIncomingOrder(integration);
  }

  @ApiOperation({ summary: 'Disconnect a Cloove channel' })
  @Delete(':storeId/channels/:channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.removeConfig(businessId, storeId, channelId);
  }

  /** The URL the merchant registers in Cloove's developer portal. */
  private webhookUrl(req: Request, channelId: string): string {
    return `${this.publicBase(req)}/webhook/cloveai/${channelId}`;
  }

  /**
   * Same rule as the Chowdeck controller: PUBLIC_URL when set, else whatever
   * host the proxy says we were reached on.
   */
  private publicBase(req: Request): string {
    const configured =
      this.config.get<string>('PUBLIC_URL') ?? this.config.get<string>('APP_PUBLIC_URL');
    if (configured) return configured.replace(/\/+$/, '');
    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https')
      .split(',')[0]
      .trim();
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
      .split(',')[0]
      .trim();
    return `${proto}://${host}`;
  }
}
