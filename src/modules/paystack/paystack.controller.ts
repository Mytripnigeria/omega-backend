import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { IntegrationsService } from '../integrations/integrations.service';

@ApiTags('paystack')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('paystack')
export class PaystackController {
  constructor(private readonly integrations: IntegrationsService) {}

  @ApiOperation({
    summary: 'Get this business\'s Paystack public key',
    description:
      "Returns the authenticated business's own Paystack public key (set in " +
      'Settings → Integrations). Empty when Paystack is not enabled. Safe to ' +
      'expose — only the secret key is kept private.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { publicKey: { type: 'string' } } },
  })
  @Get('public-key')
  async publicKey(
    @BusinessId() businessId: string,
  ): Promise<{ publicKey: string }> {
    const cred = await this.integrations.getActiveCredential(
      businessId,
      'paystack',
    );
    return { publicKey: cred?.publicKey ?? '' };
  }
}
