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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { ChowdeckService } from './chowdeck.service';
import { ChowdeckIngestService } from './chowdeck-ingest.service';
import { UpsertChowdeckIntegrationDto } from './dto/chowdeck-integration.dto';

/**
 * Merchant-facing Chowdeck configuration (Plugins → Omnichannel in the hub).
 * Store-scoped: a Chowdeck merchant reference is one vendor location.
 */
@ApiTags('chowdeck')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/chowdeck')
export class ChowdeckController {
  constructor(
    private readonly service: ChowdeckService,
    private readonly ingest: ChowdeckIngestService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({
    summary: "A store's Chowdeck connection",
    description:
      'Returns null when the store is not connected. The secret key is only ' +
      'ever returned as a masked preview.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Get(':storeId')
  async get(@Req() req: Request, @BusinessId() businessId: string, @Param('storeId') storeId: string) {
    const config = await this.service.getConfig(businessId, storeId);
    if (!config) return null;
    return {
      ...config,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(req),
      ),
    };
  }

  @ApiOperation({
    summary: "Every Chowdeck channel on a store",
    description:
      'A store can sell through more than one Chowdeck vendor listing — one ' +
      'kitchen often appears under several brands. Each channel has its own ' +
      'credentials, menu map and webhook URL.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Get(':storeId/channels')
  async channels(
    @Req() req: Request, @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
  ) {
    const rows = await this.service.listChannels(businessId, storeId);
    return Promise.all(
      rows.map(async (c) => ({
        ...c,
        webhookUrl: await this.service.webhookUrl(
          businessId,
          storeId,
          this.publicBase(req),
          c.id,
        ),
      })),
    );
  }

  @ApiOperation({ summary: 'Add a Chowdeck channel to a store' })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Post(':storeId/channels')
  async addChannel(
    @Req() req: Request, @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertChowdeckIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(businessId, storeId, {
      ...dto,
      createNew: true,
    });
    return {
      ...saved,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(req),
        saved.id,
      ),
    };
  }

  @ApiOperation({ summary: 'Update one Chowdeck channel' })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @ApiParam({ name: 'channelId', format: 'uuid' })
  @Put(':storeId/channels/:channelId')
  async updateChannel(
    @Req() req: Request, @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpsertChowdeckIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(
      businessId,
      storeId,
      dto,
      channelId,
    );
    return {
      ...saved,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(req),
        saved.id,
      ),
    };
  }

  @ApiOperation({ summary: 'Check one channel’s credentials' })
  @Post(':storeId/channels/:channelId/test')
  @HttpCode(HttpStatus.OK)
  testChannel(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.testConnection(businessId, storeId, channelId);
  }

  @ApiOperation({ summary: 'Publish the store menu to one channel' })
  @Post(':storeId/channels/:channelId/sync-menu')
  @HttpCode(HttpStatus.OK)
  syncChannelMenu(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.syncMenu(businessId, storeId, channelId);
  }

  @ApiOperation({
    summary: 'Send a test order through this channel',
    description:
      "Chowdeck's sandbox cannot create an order against your own vendor, so " +
      'this injects a realistic one through the same path a live order takes. ' +
      'It lands in the counter POS (and the kitchen) exactly like the real ' +
      'thing, and deducts stock, so the workstation flow can be rehearsed ' +
      'before going live. Publish the menu first — the order is built from ' +
      'products actually mapped to this channel.',
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

  @ApiOperation({ summary: 'Remove one Chowdeck channel' })
  @Delete(':storeId/channels/:channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeChannel(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.service.removeConfig(businessId, storeId, channelId);
  }

  @ApiOperation({
    summary: 'Connect or update a store',
    description:
      'Omit `secretKey` when updating to keep the stored key. Also mints the ' +
      "store's webhook URL, which the merchant pastes into Chowdeck.",
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Put(':storeId')
  async upsert(
    @Req() req: Request, @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertChowdeckIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(businessId, storeId, dto);
    return {
      ...saved,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(req),
      ),
    };
  }

  @ApiOperation({
    summary: 'Check the credentials work',
    description: 'Makes one authenticated call to Chowdeck and reports back.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @ApiOkResponse({ schema: { example: { ok: true, menuItems: 15 } } })
  @Post(':storeId/test')
  @HttpCode(HttpStatus.OK)
  test(@BusinessId() businessId: string, @Param('storeId') storeId: string) {
    return this.service.testConnection(businessId, storeId);
  }

  @ApiOperation({
    summary: 'Publish the store menu to Chowdeck',
    description:
      "Uploads active products keyed by our product id, then reads Chowdeck's " +
      'menu back to map their numeric menu ids onto our products. That map is ' +
      'what lets an incoming order deduct the right inventory, so this must be ' +
      'run before taking Chowdeck orders — and again after menu changes.',
  })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @ApiOkResponse({
    schema: { example: { published: 24, accepted: 24, mapped: 24, unmapped: [] } },
  })
  @Post(':storeId/sync-menu')
  @HttpCode(HttpStatus.OK)
  syncMenu(@BusinessId() businessId: string, @Param('storeId') storeId: string) {
    return this.service.syncMenu(businessId, storeId);
  }

  @ApiOperation({ summary: 'Disconnect a store from Chowdeck' })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Delete(':storeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('storeId') storeId: string) {
    return this.service.removeConfig(businessId, storeId);
  }

  /**
   * Public origin webhooks should be sent to — this API's own.
   *
   * `PUBLIC_URL` when set; otherwise the origin the current request arrived
   * on, read through the proxy headers. The previous fallback was the
   * dashboard's hostname, so with the env var unset in production the URL
   * handed to Chowdeck pointed at a static Vercel page: every real order
   * webhook was answered with the SPA's index.html and none reached us.
   */
  private publicBase(req: Request): string {
    const configured =
      this.config.get<string>('PUBLIC_URL') ??
      this.config.get<string>('APP_PUBLIC_URL');
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
