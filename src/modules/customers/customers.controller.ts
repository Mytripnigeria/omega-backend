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
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerFilterDto } from './dto/customer-filter.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import {
  PointsActionDto,
  WalletActionDto,
} from './dto/wallet-action.dto';
import {
  PointsTransactionResponseDto,
  WalletTransactionResponseDto,
} from './dto/wallet-response.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @ApiOperation({ summary: 'Customer statistics' })
  @ApiOkResponse({
    schema: {
      example: {
        total: 122,
        active: 110,
        vip: 12,
        newThisMonth: 8,
        totalWalletBalance: 540000,
        totalPoints: 23400,
      },
    },
  })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @ApiOperation({ summary: 'List customers' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/CustomerResponseDto' } },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  })
  @Get()
  list(@BusinessId() businessId: string, @Query() filter: CustomerFilterDto) {
    return this.service.findAll(businessId, filter);
  }

  @ApiOperation({ summary: 'Create customer' })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    const admin = req.user as AdminJwtPayload;
    return this.service.create(admin, dto);
  }

  @ApiOperation({ summary: 'Get a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const admin = req.user as AdminJwtPayload;
    return this.service.update(admin, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    const admin = req.user as AdminJwtPayload;
    return this.service.remove(admin, id);
  }

  @ApiOperation({ summary: 'Wallet transactions for a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [WalletTransactionResponseDto] })
  @Get(':id/wallet-transactions')
  walletTxs(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.getWalletTransactions(businessId, id);
  }

  @ApiOperation({ summary: 'Credit a customer wallet' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: WalletTransactionResponseDto })
  @Post(':id/wallet/credit')
  credit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: WalletActionDto,
  ) {
    const admin = req.user as AdminJwtPayload;
    return this.service.creditWallet(
      admin,
      id,
      dto.amount,
      dto.description,
      dto.reference,
    );
  }

  @ApiOperation({ summary: 'Debit a customer wallet' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: WalletTransactionResponseDto })
  @Post(':id/wallet/debit')
  debit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: WalletActionDto,
  ) {
    const admin = req.user as AdminJwtPayload;
    return this.service.debitWallet(
      admin,
      id,
      dto.amount,
      dto.description,
      dto.reference,
    );
  }

  @ApiOperation({ summary: 'Points transactions for a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [PointsTransactionResponseDto] })
  @Get(':id/points-transactions')
  pointsTxs(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.getPointsTransactions(businessId, id);
  }

  @ApiOperation({ summary: 'Add points to a customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PointsTransactionResponseDto })
  @Post(':id/points/add')
  addPoints(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PointsActionDto,
  ) {
    const admin = req.user as AdminJwtPayload;
    return this.service.addPoints(
      admin,
      id,
      dto.points,
      dto.description,
      dto.orderId,
    );
  }

  @ApiOperation({ summary: 'Redeem customer points' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PointsTransactionResponseDto })
  @Post(':id/points/redeem')
  redeemPoints(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PointsActionDto,
  ) {
    const admin = req.user as AdminJwtPayload;
    return this.service.redeemPoints(admin, id, dto.points, dto.description);
  }
}
