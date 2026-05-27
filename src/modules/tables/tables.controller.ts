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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { TablesService } from './tables.service';
import {
  CreateTableDto,
  TableFilterDto,
  TableResponseDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/table.dto';

// Tables are managed by admins (CRUD) but updated frequently by staff during
// service (status changes, assigning to orders) — so reads + status changes
// accept either JWT, while create/edit/delete add admin-only on top.
@ApiTags('tables')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @ApiOperation({ summary: 'List tables' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiOkResponse({ type: [TableResponseDto] })
  @Get()
  list(
    @BusinessContext() businessId: string,
    @Query() filter: TableFilterDto,
  ) {
    return this.tablesService.list(businessId, filter);
  }

  @ApiOperation({ summary: 'Get a single table' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TableResponseDto })
  @Get(':id')
  findOne(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.tablesService.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Create a table (admin)' })
  @ApiCreatedResponse({ type: TableResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@BusinessContext() businessId: string, @Body() dto: CreateTableDto) {
    return this.tablesService.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Update a table (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TableResponseDto })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @BusinessContext() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.update(businessId, id, dto);
  }

  @ApiOperation({
    summary: 'Update table status (staff or admin)',
    description:
      'Fast status-only update used during service (available → occupied → cleaning → available). Available to staff JWTs as well.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TableResponseDto })
  @Patch(':id/status')
  updateStatus(
    @BusinessContext() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateStatus(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a table (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.tablesService.remove(businessId, id);
  }
}
