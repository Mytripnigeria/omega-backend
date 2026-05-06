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
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { CustomerPaymentMethodsService } from './customer-payment-methods.service';
import {
  CreateCustomerPaymentMethodDto,
  CustomerPaymentMethodResponseDto,
  UpdateCustomerPaymentMethodDto,
} from './dto/customer-payment-method.dto';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/payment-methods')
export class CustomerPaymentMethodsController {
  constructor(private readonly service: CustomerPaymentMethodsService) {}

  @ApiOperation({ summary: 'List my payment methods' })
  @ApiOkResponse({ type: [CustomerPaymentMethodResponseDto] })
  @Get()
  list(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.service.list(user.businessId, user.customerId);
  }

  @ApiOperation({ summary: 'Save a payment method (Paystack authorization code)' })
  @ApiCreatedResponse({ type: CustomerPaymentMethodResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateCustomerPaymentMethodDto) {
    const user = req.user as UserJwtPayload;
    return this.service.create(user.businessId, user.customerId, dto);
  }

  @ApiOperation({ summary: 'Update a payment method' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerPaymentMethodResponseDto })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerPaymentMethodDto,
  ) {
    const user = req.user as UserJwtPayload;
    return this.service.update(user.businessId, user.customerId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a payment method' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as UserJwtPayload;
    return this.service.remove(user.businessId, user.customerId, id);
  }
}
