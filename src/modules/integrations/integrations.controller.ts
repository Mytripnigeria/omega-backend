import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { IntegrationsService } from './integrations.service';
import {
  IntegrationResponseDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/payment-providers')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @ApiOperation({
    summary: 'List payment-provider integrations',
    description:
      'Returns each supported provider (Paystack, Flutterwave) with its saved ' +
      'config. Secret keys are returned masked, never raw.',
  })
  @ApiOkResponse({ type: [IntegrationResponseDto] })
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({
    summary: 'Save a payment-provider integration',
    description:
      'Upserts the credentials for a provider. Omit `secretKey` to keep the ' +
      'existing secret unchanged.',
  })
  @ApiParam({ name: 'provider', example: 'paystack' })
  @ApiOkResponse({ type: IntegrationResponseDto })
  @Put(':provider')
  upsert(
    @BusinessId() businessId: string,
    @Param('provider') provider: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.service.upsert(businessId, provider, dto);
  }
}
