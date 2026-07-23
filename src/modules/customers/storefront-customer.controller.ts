import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import {
  PointsTransactionResponseDto,
  WalletTransactionResponseDto,
} from './dto/wallet-response.dto';
import {
  WalletDepositInitDto,
  WalletDepositVerifyDto,
} from './dto/wallet-deposit.dto';
import { WalletDepositService } from './wallet-deposit.service';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me')
export class StorefrontCustomerController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly walletDeposit: WalletDepositService,
  ) {}

  @ApiOperation({
    summary: 'Start a wallet top-up',
    description:
      'Initialises a Paystack transaction for the given amount and returns the ' +
      'access code for the inline popup. Nothing is credited until ' +
      'POST /storefront/me/wallet/deposit/verify confirms the charge.',
  })
  @Post('wallet/deposit')
  async startDeposit(@Req() req: Request, @Body() dto: WalletDepositInitDto) {
    const user = req.user as UserJwtPayload;
    return this.walletDeposit.initialize(user, dto.amount);
  }

  @ApiOperation({
    summary: 'Confirm a wallet top-up',
    description:
      'Verifies the reference with Paystack and credits the wallet. Idempotent ' +
      '— repeating it for the same reference never double-credits.',
  })
  @Post('wallet/deposit/verify')
  async verifyDeposit(@Req() req: Request, @Body() dto: WalletDepositVerifyDto) {
    const user = req.user as UserJwtPayload;
    return this.walletDeposit.verify(user, dto.reference);
  }

  @ApiOperation({ summary: 'Get current storefront user profile' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @Get()
  async getMe(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.customersService.findOne(user.businessId, user.customerId);
  }

  @ApiOperation({ summary: 'Update current storefront user profile' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @Patch()
  async updateMe(@Req() req: Request, @Body() dto: UpdateCustomerDto) {
    const user = req.user as UserJwtPayload;
    return this.customersService.update(
      { sub: user.sub, email: user.email, businessId: user.businessId },
      user.customerId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get current storefront user wallet transactions' })
  @ApiOkResponse({ type: [WalletTransactionResponseDto] })
  @Get('wallet-transactions')
  async getMyWallet(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.customersService.getWalletTransactions(
      user.businessId,
      user.customerId,
    );
  }

  @ApiOperation({ summary: 'Get current storefront user points transactions' })
  @ApiOkResponse({ type: [PointsTransactionResponseDto] })
  @Get('points-transactions')
  async getMyPoints(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.customersService.getPointsTransactions(
      user.businessId,
      user.customerId,
    );
  }
}
