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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import {
  StaffResponseDto,
  StaffDocumentResponseDto,
} from './dto/staff-response.dto';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({
    summary: 'Staff statistics',
    description: 'Returns total, active, inactive, on-leave, and terminated counts, broken down by employment type.',
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      example: {
        total: 12,
        active: 10,
        inactive: 1,
        onLeave: 1,
        terminated: 0,
        byEmploymentType: { 'full-time': 8, 'part-time': 3, contract: 1, intern: 0 },
      },
    },
  })
  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.staffService.getStats(storeId);
  }

  @ApiOperation({ summary: 'Create a staff member', description: 'Admin-only.' })
  @ApiCreatedResponse({ type: StaffResponseDto })
  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @ApiOperation({ summary: 'List staff', description: 'Returns paginated staff for the store or business.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/StaffResponseDto' } },
        total: { type: 'integer', example: 12 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @Get()
  findAll(@Query() filter: StaffFilterDto) {
    return this.staffService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single staff member' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StaffResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a staff member', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StaffResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a staff member', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @ApiOperation({
    summary: 'Set staff PIN',
    description: 'Admin-only. Sets or replaces the 4-digit workstation PIN for a staff member.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Patch(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPin(@Param('id') id: string, @Body() dto: SetPinDto) {
    return this.staffService.setPin(id, dto);
  }

  @ApiOperation({ summary: 'Clear staff PIN', description: 'Admin-only. Removes the PIN so the staff member cannot log in.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearPin(@Param('id') id: string) {
    return this.staffService.clearPin(id);
  }

  @ApiOperation({ summary: 'Upload a staff document', description: 'Admin-only. Attaches a document record to a staff member.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: StaffDocumentResponseDto })
  @Post(':id/documents')
  addDocument(@Param('id') staffId: string, @Body() dto: AddDocumentDto) {
    return this.staffService.addDocument(staffId, dto);
  }

  @ApiOperation({ summary: 'Remove a staff document', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Staff ID' })
  @ApiParam({ name: 'docId', format: 'uuid', description: 'Document ID' })
  @ApiNoContentResponse()
  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(@Param('id') staffId: string, @Param('docId') docId: string) {
    return this.staffService.removeDocument(staffId, docId);
  }
}
