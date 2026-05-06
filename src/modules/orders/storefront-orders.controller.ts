import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { OrdersService } from './orders.service';
import { StorefrontOrdersService } from './storefront-orders.service';
import { OrderFilterDto } from './dto/order-filter.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import {
  StorefrontCreateOrderDto,
  VerifyOrderPaymentDto,
} from './dto/storefront-create-order.dto';
import { PaystackService } from '../paystack/paystack.service';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/orders')
export class StorefrontOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly storefrontOrders: StorefrontOrdersService,
  ) {}

  @ApiOperation({ summary: 'List my orders' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/OrderResponseDto' } },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  })
  @Get()
  list(@Req() req: Request, @Query() filter: OrderFilterDto) {
    const user = req.user as UserJwtPayload;
    return this.ordersService.findAll(
      {
        sub: user.sub,
        sub_type: 'admin',
        businessId: user.businessId,
        actorName: user.email,
      },
      { ...filter, customerId: user.customerId },
    );
  }

  @ApiOperation({
    summary: 'Place an order',
    description:
      'Creates an order linked to the authenticated customer. Returns Paystack initialization details when paymentChannel=paystack and the customer needs to complete payment.',
  })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        order: { $ref: '#/components/schemas/OrderResponseDto' },
        payment: {
          type: 'object',
          additionalProperties: true,
          nullable: true,
        },
      },
    },
  })
  @Post()
  place(@Req() req: Request, @Body() dto: StorefrontCreateOrderDto) {
    const user = req.user as UserJwtPayload;
    return this.storefrontOrders.place(user, dto);
  }

  @ApiOperation({
    summary: 'Verify a Paystack payment',
    description:
      'Called by the storefront after Paystack returns. Idempotent — calling it on an already-paid order is a no-op.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Post(':id/verify-payment')
  verify(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VerifyOrderPaymentDto,
  ) {
    const user = req.user as UserJwtPayload;
    return this.storefrontOrders.verifyPayment(user, id, dto.reference);
  }

  @ApiOperation({ summary: 'Get one of my orders' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as UserJwtPayload;
    return this.ordersService.findOne(
      {
        sub: user.sub,
        sub_type: 'admin',
        businessId: user.businessId,
        actorName: user.email,
      },
      id,
    );
  }
}

// ─── Paystack webhook (no auth, signature-verified) ────────────────────

@ApiTags('webhooks')
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  constructor(
    private readonly paystack: PaystackService,
    private readonly storefrontOrders: StorefrontOrdersService,
  ) {}

  @ApiOperation({
    summary: 'Paystack webhook (charge.success)',
    description:
      'Receives Paystack events. The signature is verified with the configured secret; only `charge.success` events trigger order updates.',
  })
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const valid = this.paystack.verifyWebhookSignature(
      raw ?? JSON.stringify(body),
      signature,
    );
    if (!valid) throw new BadRequestException('Invalid signature');

    const event = body.event as string | undefined;
    const data = body.data as { reference?: string } | undefined;
    if (event === 'charge.success' && data?.reference) {
      await this.storefrontOrders.applyWebhookSuccess(data.reference);
    }
    return { received: true };
  }
}
