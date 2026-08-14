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
  UseGuards,
} from '@nestjs/common';
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
  async get(@BusinessId() businessId: string, @Param('storeId') storeId: string) {
    const config = await this.service.getConfig(businessId, storeId);
    if (!config) return null;
    return {
      ...config,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(),
      ),
    };
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
    @BusinessId() businessId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpsertChowdeckIntegrationDto,
  ) {
    const saved = await this.service.upsertConfig(businessId, storeId, dto);
    return {
      ...saved,
      webhookUrl: await this.service.webhookUrl(
        businessId,
        storeId,
        this.publicBase(),
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

  /** Public origin webhooks should be sent to. */
  private publicBase(): string {
    return (
      this.config.get<string>('PUBLIC_URL') ??
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://app.omega.com.ng'
    );
  }
}
