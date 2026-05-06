import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { ReviewsService } from './reviews.service';
import {
  CreateOrderReviewDto,
  OrderReviewFilterDto,
  OrderReviewResponseDto,
  UpdateOrderReviewModerationDto,
} from './dto/order-review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class AdminReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @ApiOperation({ summary: 'List reviews (admin)' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: OrderReviewFilterDto,
  ) {
    return this.service.list(businessId, filter);
  }

  @ApiOperation({ summary: 'Publish or hide a review' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderReviewResponseDto })
  @Patch(':id')
  moderate(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderReviewModerationDto,
  ) {
    return this.service.moderate(businessId, id, dto);
  }
}

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/orders/:orderId/review')
export class StorefrontOrderReviewController {
  constructor(private readonly service: ReviewsService) {}

  @ApiOperation({ summary: 'Get my review for an order (or null)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @Get()
  get(@Req() req: Request, @Param('orderId') orderId: string) {
    const user = req.user as UserJwtPayload;
    return this.service.findForOrder(user.customerId, orderId);
  }

  @ApiOperation({ summary: 'Submit a review for an order' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiCreatedResponse({ type: OrderReviewResponseDto })
  @Post()
  submit(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderReviewDto,
  ) {
    const user = req.user as UserJwtPayload;
    return this.service.submit(user.businessId, user.customerId, orderId, dto);
  }
}

@ApiTags('public-storefront')
@Controller('public/storefront/reviews')
export class PublicReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @ApiOperation({ summary: 'List published reviews' })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @Get()
  list(
    @Query('businessId') businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.listPublic(businessId, storeId);
  }
}
