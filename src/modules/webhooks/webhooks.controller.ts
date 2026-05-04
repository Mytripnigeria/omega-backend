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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateWebhookDto) {
    const { webhook, secret } = await this.service.create(businessId, dto);
    // Secret is returned once on create; never on subsequent reads.
    return { ...webhook, secret };
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @Post(':id/rotate-secret')
  rotate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.rotateSecret(businessId, id);
  }

  @Post(':id/test')
  test(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.test(businessId, id);
  }
}
