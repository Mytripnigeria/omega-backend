import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { MerchantWalletService } from './merchant-wallet.service';
import {
  MerchantWalletResponseDto,
  MerchantWalletTxFilterDto,
} from './dto/merchant-wallet.dto';

@ApiTags('merchant-wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchant-wallet')
export class MerchantWalletController {
  constructor(private readonly service: MerchantWalletService) {}

  @ApiOperation({ summary: 'Current merchant wallet balance' })
  @ApiOkResponse({ type: MerchantWalletResponseDto })
  @Get()
  get(@BusinessId() businessId: string) {
    return this.service.getWallet(businessId);
  }

  @ApiOperation({
    summary: 'Paginated wallet transaction history',
    description:
      'Append-only ledger of every wallet movement (order credits, payout reservations, settlements).',
  })
  @Get('transactions')
  transactions(
    @BusinessId() businessId: string,
    @Query() filter: MerchantWalletTxFilterDto,
  ) {
    return this.service.listTransactions(businessId, filter);
  }
}
