import {
  Body,
  Controller,
  Get,
  Patch,
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

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me')
export class StorefrontCustomerController {
  constructor(private readonly customersService: CustomersService) {}

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
