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
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { PrintersService } from './printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { FilterPrinterDto } from './dto/filter-printer.dto';
import { PrinterResponseDto } from './dto/printer-response.dto';
import { PrintJobResponseDto } from './dto/print-job-response.dto';
import type { PrintJobStatus } from './entities/print-job.entity';

// Printer management is workstation-driven (staff manage devices on-site),
// so all endpoints accept either admin or staff JWTs. The business scope is
// resolved from whichever token signed the request.
@ApiTags('printers')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('printers')
export class PrintersController {
  constructor(private readonly service: PrintersService) {}

  @ApiOperation({ summary: 'List printers', description: 'Returns all printers for the business, optionally scoped to a store.' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({ type: [PrinterResponseDto] })
  @Get()
  list(@BusinessContext() businessId: string, @Query() query: FilterPrinterDto) {
    return this.service.list(businessId, query.storeId);
  }

  @ApiOperation({ summary: 'Register a printer', description: 'Adds a new printer to the store.' })
  @ApiCreatedResponse({ type: PrinterResponseDto })
  @Post()
  create(@BusinessContext() businessId: string, @Body() dto: CreatePrinterDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'Get a single printer',
    description: '`lastSeenAt` is updated by the printer heartbeat when it comes online.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PrinterResponseDto })
  @Get(':id')
  findOne(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a printer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PrinterResponseDto })
  @Patch(':id')
  update(
    @BusinessContext() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a printer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @ApiOperation({
    summary: 'Send a test print',
    description:
      'Queues a TEST print job and attempts best-effort ESC/POS delivery if the printer is network-attached. The returned job row reflects the outcome: `sent` (delivered), `failed` (`lastError` populated), or `queued` (non-network connection).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PrintJobResponseDto })
  @Post(':id/test')
  test(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.service.runTestPrint(businessId, id);
  }

  @ApiOperation({ summary: 'Recent print jobs for a printer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'status', required: false, enum: ['queued', 'sent', 'failed'] })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: [PrintJobResponseDto] })
  @Get(':id/jobs')
  jobs(
    @BusinessContext() businessId: string,
    @Param('id') id: string,
    @Query('status') status?: PrintJobStatus,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 25;
    return this.service.listJobs(businessId, id, status, parsed);
  }
}
