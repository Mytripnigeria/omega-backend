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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { SupplierResponseDto } from './dto/supplier-response.dto';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @ApiOperation({ summary: 'Supplier statistics' })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @ApiOperation({ summary: 'List suppliers' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: SupplierFilterDto,
  ) {
    return this.service.findAll(businessId, filter);
  }

  @ApiOperation({ summary: 'Get one supplier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupplierResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Create a supplier' })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Update a supplier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupplierResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a supplier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @ApiOperation({ summary: 'Ingredients supplied by this supplier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Get(':id/ingredients')
  ingredients(
    @BusinessId() businessId: string,
    @Param('id') id: string,
  ) {
    return this.service.getIngredientsForSupplier(businessId, id);
  }
}
