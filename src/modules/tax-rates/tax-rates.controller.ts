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
import { TaxRatesService } from './tax-rates.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { TaxRateResponseDto } from './dto/tax-rate-response.dto';

@ApiTags('tax-rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax-rates')
export class TaxRatesController {
  constructor(private readonly service: TaxRatesService) {}

  @ApiOperation({ summary: 'List tax rates', description: 'Returns all tax rates for the business.' })
  @ApiOkResponse({ type: [TaxRateResponseDto] })
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({
    summary: 'Create a tax rate',
    description:
      'Admin-only. Creates a new tax rate. Set `isInclusive: true` if tax is embedded in the product price; `false` if it is added on top. ' +
      'At most one rate can have `isDefault: true`.',
  })
  @ApiCreatedResponse({ type: TaxRateResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateTaxRateDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single tax rate' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TaxRateResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a tax rate', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TaxRateResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a tax rate', description: 'Admin-only. Soft-delete.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
