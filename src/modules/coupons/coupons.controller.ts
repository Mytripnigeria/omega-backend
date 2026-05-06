import {
  BadRequestException,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { CouponsService } from './coupons.service';
import {
  CouponFilterDto,
  CouponResponseDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  ValidateCouponResponseDto,
} from './dto/coupon.dto';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('coupons')
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  @ApiOperation({ summary: 'List coupons (admin)' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: CouponFilterDto,
  ) {
    return this.service.list(businessId, filter);
  }

  @ApiOperation({ summary: 'Get a coupon by id (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CouponResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Create a coupon (admin)' })
  @ApiCreatedResponse({ type: CouponResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateCouponDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Update a coupon (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CouponResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a coupon (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}

// ─── Storefront-facing validate ────────────────────────────────────────

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/coupons')
export class StorefrontCouponsController {
  constructor(private readonly service: CouponsService) {}

  @ApiOperation({
    summary: 'Validate a coupon for the authenticated customer',
    description:
      'Returns the discount amount and the coupon record if the code is valid for the supplied subtotal.',
  })
  @ApiOkResponse({ type: ValidateCouponResponseDto })
  @Post('validate')
  validate(@Req() req: Request, @Body() dto: ValidateCouponDto) {
    const user = req.user as UserJwtPayload;
    return this.service.validate(
      user.businessId,
      user.customerId,
      dto.code,
      dto.subtotal,
      dto.items ?? [],
    );
  }
}

// ─── Public validate (guest flow, no customer) ─────────────────────────

@ApiTags('public-storefront')
@Controller('public/storefront/coupons')
export class PublicCouponsController {
  constructor(private readonly service: CouponsService) {}

  @ApiOperation({
    summary: 'Validate a coupon (guest)',
    description: 'No per-customer cap is enforced because there is no auth context.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @ApiOkResponse({ type: ValidateCouponResponseDto })
  @Post('validate')
  validate(
    @Query('businessId') businessId: string,
    @Body() dto: ValidateCouponDto,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.validate(
      businessId,
      null,
      dto.code,
      dto.subtotal,
      dto.items ?? [],
    );
  }
}
