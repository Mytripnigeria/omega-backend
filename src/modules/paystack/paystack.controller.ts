import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { PaystackService } from './paystack.service';

@ApiTags('paystack')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('paystack')
export class PaystackController {
  constructor(private readonly paystack: PaystackService) {}

  @ApiOperation({
    summary: 'Get Paystack public key',
    description:
      'Returns the configured Paystack public key. Safe to expose — only the secret key must be kept private.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { publicKey: { type: 'string' } } },
  })
  @Get('public-key')
  publicKey(): { publicKey: string } {
    return { publicKey: this.paystack.publicKey() };
  }
}
