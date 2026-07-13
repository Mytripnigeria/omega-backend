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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import {
  ReorderPaymentMethodsDto,
  UpdatePaymentMethodDto,
} from './dto/update-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';
import { PaymentMethodChannel } from './entities/payment-method.entity';

// NOTE: Guards are applied per-method (not at the class level) so the
// read-only `enabled` route can accept BOTH an admin JWT (merchant hub) and a
// staff JWT (workstation), while every create/update/delete route stays
// admin-only.
@ApiTags('payment-methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @ApiOperation({ summary: 'List payment methods', description: 'Returns all payment methods for the business, ordered by `order` field.' })
  @ApiOkResponse({ type: [PaymentMethodResponseDto] })
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({
    summary: 'List enabled payment methods for a workstation channel',
    description:
      'Staff- and admin-accessible. Returns only ENABLED methods visible on ' +
      'the given channel (`pos` or `self`). Used by the workstation Counter ' +
      'POS / Self-Service screens to render payment options from merchant ' +
      'settings instead of a hardcoded Cash/Card pair.',
  })
  @ApiQuery({ name: 'channel', enum: ['pos', 'self', 'storefront', 'omni'], required: false })
  @ApiOkResponse({ type: [PaymentMethodResponseDto] })
  @UseGuards(JwtOrStaffGuard)
  @Get('enabled')
  listEnabled(
    @BusinessContext() businessId: string,
    @Query('channel') channel?: PaymentMethodChannel,
  ) {
    return this.service.listEnabledForChannel(businessId, channel ?? 'pos');
  }

  @ApiOperation({ summary: 'Create a payment method', description: 'Admin-only. Adds a payment method (e.g. Cash, Card, Bank Transfer).' })
  @ApiCreatedResponse({ type: PaymentMethodResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreatePaymentMethodDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'Reorder payment methods',
    description: 'Admin-only. Bulk-updates the `order` field. The order controls the display sequence on the POS checkout screen.',
  })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@BusinessId() businessId: string, @Body() dto: ReorderPaymentMethodsDto) {
    return this.service.reorder(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single payment method' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentMethodResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a payment method', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentMethodResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a payment method', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
