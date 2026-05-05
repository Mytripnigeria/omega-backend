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
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { PrintersService } from './printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { FilterPrinterDto } from './dto/filter-printer.dto';
import { PrinterResponseDto } from './dto/printer-response.dto';

@ApiTags('printers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('printers')
export class PrintersController {
  constructor(private readonly service: PrintersService) {}

  @ApiOperation({ summary: 'List printers', description: 'Returns all printers for the business, optionally scoped to a store.' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: [PrinterResponseDto] })
  @Get()
  list(@BusinessId() businessId: string, @Query() query: FilterPrinterDto) {
    return this.service.list(businessId, query.storeId);
  }

  @ApiOperation({ summary: 'Register a printer', description: 'Admin-only. Adds a new printer to the store.' })
  @ApiCreatedResponse({ type: PrinterResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreatePrinterDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'Get a single printer',
    description: '`lastSeenAt` is updated by the printer heartbeat when it comes online.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PrinterResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a printer', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PrinterResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a printer', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
