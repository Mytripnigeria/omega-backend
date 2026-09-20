import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  CancelOrderDto,
  OrderFilterDto,
  RecordPaymentDto,
  RefundOrderDto,
  UpdateOrderStatusDto,
  UpdatePrepStatusDto,
} from './dto/order-filter.dto';
import {
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { OrderStatusEventResponseDto } from './dto/order-status-event-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
} {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff',
      businessId: user.businessId,
      storeId: user.storeId,
      actorName: user.staffCode,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin',
    businessId: user.businessId,
    actorName: user.email,
  };
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @ApiOperation({
    summary: 'Create an order',
    description:
      'Creates a new order with line items. Allocates the next sequential order number ' +
      'for the staff\'s store. Subtotal is computed from items; tax/discount are taken from the body. ' +
      'Initial status is `pending`.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({
    summary: 'List orders',
    description:
      'Returns paginated orders. Staff tokens are auto-scoped to their store. Use ' +
      '`status=pending,preparing` to filter by multiple statuses at once.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/OrderResponseDto' } },
        total: { type: 'integer', example: 142 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 8 },
      },
    },
  })
  @Get()
  findAll(@Req() req: AuthedRequest, @Query() filter: OrderFilterDto) {
    return this.service.findAll(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Order statistics', description: 'Today counts/revenue + open queue counts.' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      example: {
        todayCount: 24,
        todayRevenue: 184500,
        pendingCount: 3,
        preparingCount: 5,
        readyCount: 2,
      },
    },
  })
  @Get('stats')
  getStats(@Req() req: AuthedRequest, @Query('storeId') storeId?: string) {
    return this.service.getStats(actorFrom(req), storeId);
  }

  @ApiOperation({ summary: 'Get a single order' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Update order status',
    description:
      'Transitions the order through its lifecycle: pending → preparing → ready → served → completed. ' +
      'Cancellation is also possible from any non-terminal state.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Patch(':id/status')
  updateStatus(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.service.updateStatus(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Send an order to the kitchen',
    description:
      'Hands an accepted (PENDING) order to the kitchen. The order stays ' +
      'PENDING — it is already on the kitchen board, waiting for a cook to ' +
      'start preparing — and the hand-over is recorded on `sentToKitchenAt`. ' +
      "For a Cloove order this moves Cloove's kitchen ticket to `queued` " +
      'first, and the order is left untouched if Cloove refuses. Calling it ' +
      'twice is a no-op.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Post(':id/send-to-kitchen')
  sendToKitchen(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.sendToKitchen(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancels a non-terminal order. Captures an optional reason in the audit log.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Post(':id/cancel')
  cancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.service.cancel(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Record payment',
    description:
      'Records a payment against the order. Defaults to outstanding balance if `amount` is omitted. ' +
      'When fully paid AND already served, transitions to `completed`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Post(':id/payment')
  payment(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.service.recordPayment(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Refund an order',
    description:
      'Issues a partial or full refund. Validates amount ≤ paidAmount - refundedAmount. ' +
      'Creates a debit row in the financial ledger and an order status event.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @Post(':id/refund')
  refund(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
  ) {
    return this.service.refund(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Order status timeline',
    description:
      'Returns every status transition (and refund/cancellation events) for the order in chronological order.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [OrderStatusEventResponseDto] })
  @Get(':id/events')
  async events(@Req() req: AuthedRequest, @Param('id') id: string) {
    const events = await this.service.getEvents(actorFrom(req), id);
    return events.map(OrderStatusEventResponseDto.from);
  }

  @ApiOperation({
    summary: 'Update item prep status',
    description:
      'Kitchen-facing endpoint. Marks a single line item as pending/preparing/ready. ' +
      'Auto-promotes the order from pending → preparing on first item start, and from ' +
      'preparing → ready when all items are ready.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Order id' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: OrderItemResponseDto })
  @Post(':id/items/:itemId/prep-status')
  @HttpCode(HttpStatus.OK)
  updateItemPrep(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePrepStatusDto,
  ) {
    return this.service.updateItemPrepStatus(actorFrom(req), id, itemId, dto);
  }
}
