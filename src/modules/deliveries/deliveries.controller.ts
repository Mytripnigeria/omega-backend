import {
  Body,
  Controller,
  Get,
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
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { DeliveriesService } from './deliveries.service';
import {
  AssignDeliveryDto,
  CreateDeliveryDto,
  DeliveryFilterDto,
  FailDeliveryDto,
} from './dto/delivery-dto';
import { DeliveryResponseDto } from './dto/delivery-response.dto';

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

@ApiTags('deliveries')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @ApiOperation({
    summary: 'Create a delivery',
    description:
      'Creates a delivery record for an existing order. Captures address + optional ' +
      'phone/coordinates. Marks the order as `isDelivery=true` if not already set.',
  })
  @ApiCreatedResponse({ type: DeliveryResponseDto })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateDeliveryDto) {
    return this.service.create(actorFrom(req), dto);
  }

  @ApiOperation({
    summary: 'List deliveries',
    description:
      'Returns paginated deliveries scoped to the caller\'s business. Staff are ' +
      'auto-scoped to their store. Filter by status (`pending,assigned,in_transit,delivered,failed`), ' +
      'rider, or date range.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/DeliveryResponseDto' } },
        total: { type: 'integer', example: 24 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 2 },
      },
    },
  })
  @Get()
  findAll(@Req() req: AuthedRequest, @Query() filter: DeliveryFilterDto) {
    return this.service.findAll(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'My deliveries (rider view)',
    description: 'Staff-only. Returns deliveries assigned to the authenticated rider.',
  })
  @ApiOkResponse({ description: 'Paginated DeliveryResponseDto list' })
  @Get('my')
  findMy(@Req() req: AuthedRequest, @Query() filter: DeliveryFilterDto) {
    return this.service.findMy(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single delivery' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Send for delivery (waiter dispatch)',
    description:
      'Waiter-facing. Transitions awaiting_dispatch → pending, putting the ' +
      'delivery on the rider board. Riders never see deliveries before this.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Post(':id/dispatch')
  dispatch(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.dispatch(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Assign delivery to a rider',
    description: 'Admin-only typical use. Transitions status pending → assigned.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Post(':id/assign')
  assign(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.service.assign(actorFrom(req), id, dto);
  }

  @ApiOperation({
    summary: 'Mark as picked up',
    description: 'Rider-facing. Transitions assigned → in_transit. Records pickup time.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Post(':id/pickup')
  pickup(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.pickup(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Mark as delivered',
    description:
      'Rider-facing. Transitions in_transit → delivered. Auto-transitions the order to ' +
      '`served` if it was preparing/ready.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Post(':id/deliver')
  deliver(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.deliver(actorFrom(req), id);
  }

  @ApiOperation({
    summary: 'Mark as failed',
    description: 'Records a failure with reason. Terminal state.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @Post(':id/fail')
  fail(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: FailDeliveryDto,
  ) {
    return this.service.fail(actorFrom(req), id, dto);
  }
}
