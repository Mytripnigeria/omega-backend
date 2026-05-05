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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import {
  ReorderPaymentMethodsDto,
  UpdatePaymentMethodDto,
} from './dto/update-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';

@ApiTags('payment-methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @ApiOperation({ summary: 'List payment methods', description: 'Returns all payment methods for the business, ordered by `order` field.' })
  @ApiOkResponse({ type: [PaymentMethodResponseDto] })
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({ summary: 'Create a payment method', description: 'Admin-only. Adds a payment method (e.g. Cash, Card, Bank Transfer).' })
  @ApiCreatedResponse({ type: PaymentMethodResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreatePaymentMethodDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'Reorder payment methods',
    description: 'Admin-only. Bulk-updates the `order` field. The order controls the display sequence on the POS checkout screen.',
  })
  @ApiNoContentResponse()
  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@BusinessId() businessId: string, @Body() dto: ReorderPaymentMethodsDto) {
    return this.service.reorder(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single payment method' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentMethodResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a payment method', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentMethodResponseDto })
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
