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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { PayoutsService } from './payouts.service';
import {
  CreatePayoutBankAccountDto,
  CreatePayoutDto,
  PayoutBankAccountResponseDto,
  PayoutFilterDto,
  PayoutResponseDto,
  PayoutStatsDto,
  UpdatePayoutBankAccountDto,
} from './dto/payout.dto';

interface AuthedRequest extends Request {
  user?: AdminJwtPayload;
}

function actorFrom(req: AuthedRequest) {
  const user = req.user!;
  return {
    sub: user.sub,
    businessId: user.businessId,
    actorName: user.email,
  };
}

@ApiTags('payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly service: PayoutsService) {}

  // ─── Bank accounts ──────────────────────────────────────────────────

  @ApiOperation({ summary: 'List bank accounts' })
  @ApiOkResponse({ type: [PayoutBankAccountResponseDto] })
  @Get('bank-accounts')
  listBankAccounts(@BusinessId() businessId: string) {
    return this.service.listBankAccounts(businessId);
  }

  @ApiOperation({
    summary: 'Add a bank account',
    description:
      'Registers the account with Paystack and persists the recipient code so transfers can use it.',
  })
  @ApiCreatedResponse({ type: PayoutBankAccountResponseDto })
  @Post('bank-accounts')
  createBankAccount(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePayoutBankAccountDto,
  ) {
    return this.service.createBankAccount(actorFrom(req), dto);
  }

  @ApiOperation({ summary: 'Update a bank account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayoutBankAccountResponseDto })
  @Patch('bank-accounts/:id')
  updateBankAccount(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePayoutBankAccountDto,
  ) {
    return this.service.updateBankAccount(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Remove a bank account',
    description: 'Soft-deletes the account. Blocked if any payout is in flight against it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete('bank-accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBankAccount(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.removeBankAccount(actorFrom(req), id);
  }

  // ─── Payouts ────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List payouts' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: PayoutFilterDto,
  ) {
    return this.service.list(businessId, filter);
  }

  @ApiOperation({ summary: 'Payout stats' })
  @ApiOkResponse({ type: PayoutStatsDto })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @ApiOperation({
    summary: 'Request a payout',
    description:
      'Reserves the requested amount on the merchant wallet and enqueues the payout for processing.',
  })
  @ApiCreatedResponse({ type: PayoutResponseDto })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePayoutDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({ summary: 'Get a payout' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayoutResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }
}
