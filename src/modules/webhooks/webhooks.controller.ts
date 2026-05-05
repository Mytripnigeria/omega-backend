import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import {
  WebhookResponseDto,
  WebhookWithSecretResponseDto,
} from './dto/webhook-response.dto';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @ApiOperation({ summary: 'List webhooks', description: 'Returns all webhooks for the business. The signing secret is never included in list responses.' })
  @ApiOkResponse({ type: [WebhookResponseDto] })
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({
    summary: 'Create a webhook',
    description:
      'Admin-only. The signing `secret` is returned **once** in this response only — store it securely. ' +
      'Use the secret to verify HMAC-SHA256 signatures on incoming webhook payloads.',
  })
  @ApiCreatedResponse({ type: WebhookWithSecretResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateWebhookDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single webhook' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WebhookResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a webhook', description: 'Admin-only. Partial update (e.g. change URL or event list).' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WebhookResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a webhook', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @ApiOperation({
    summary: 'Rotate signing secret',
    description: 'Admin-only. Generates a new HMAC signing secret. The old secret is immediately invalidated. Returns the new plaintext secret one time.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { example: { secret: 'whsec_a1b2c3d4...', secretLastFour: 'a1b2' } } })
  @Post(':id/rotate-secret')
  rotate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.rotateSecret(businessId, id);
  }

  @ApiOperation({
    summary: 'Send test event',
    description: 'Admin-only. Sends a test `ping` event to the webhook URL to verify connectivity.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { example: { ok: true, status: 200 } } })
  @Post(':id/test')
  test(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.test(businessId, id);
  }
}
