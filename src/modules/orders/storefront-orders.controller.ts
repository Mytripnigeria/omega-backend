import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { OrdersService } from './orders.service';
import { OrderFilterDto } from './dto/order-filter.dto';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/orders')
export class StorefrontOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'List my orders',
    description: 'Returns the orders linked to the authenticated storefront user (across all stores in the business).',
  })
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
    // Re-use admin path with the business and customer scoped filter.
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
