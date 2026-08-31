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
  UseGuards,
} from '@nestjs/common';
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
  ) {}

  @ApiOperation({ summary: "Every Cloove channel on a store" })
  @ApiParam({ name: 'storeId', format: 'uuid' })
  @Get(':storeId/channels')
  channels(@BusinessId() businessId: string, @Param('storeId') storeId: string) {
    return this.service.listChannels(businessId, storeId);
  }

  @ApiOperation({ summary: 'Connect a Cloove channel to a store' })
  @Post(':storeId/channels')
  addChannel(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertCloveIntegrationDto,
  ) {
    return this.service.upsertConfig(businessId, storeId, {
      ...dto,
      createNew: true,
    });
  }

  @ApiOperation({ summary: 'Update one Cloove channel' })
  @Put(':storeId/channels/:channelId')
  updateChannel(
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpsertCloveIntegrationDto,
  ) {
    return this.service.upsertConfig(businessId, storeId, dto, channelId);
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
}
