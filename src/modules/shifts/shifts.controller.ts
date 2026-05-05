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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StaffJwtGuard } from '../../common/guards/staff-jwt.guard';
import { CurrentStaff } from '../../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../../common/types/jwt-payload.types';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftFilterDto } from './dto/shift-filter.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';

@ApiTags('shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @ApiOperation({ summary: 'Create a shift', description: 'Admin-only. Schedules a shift for a staff member.' })
  @ApiCreatedResponse({ type: ShiftResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateShiftDto) {
    return this.shiftsService.create(dto);
  }

  @ApiOperation({ summary: 'List shifts', description: 'Admin-only. Returns shifts filtered by store, staff, date range, or status.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ShiftResponseDto' } },
        total: { type: 'integer', example: 30 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 2 },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() filter: ShiftFilterDto) {
    return this.shiftsService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single shift' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ShiftResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a shift', description: 'Admin-only. Partial update; cannot change status via this endpoint.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ShiftResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a shift', description: 'Admin-only. Deletes a scheduled shift.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }

  @ApiOperation({
    summary: 'Clock in to a shift',
    description: 'Staff-authenticated. Records the actual clock-in timestamp and transitions status to `in-progress`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ShiftResponseDto })
  @ApiBearerAuth()
  @UseGuards(StaffJwtGuard)
  @Post(':id/clock-in')
  clockIn(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.shiftsService.clockIn(id, staff);
  }

  @ApiOperation({
    summary: 'Clock out of a shift',
    description: 'Staff-authenticated. Records the actual clock-out timestamp and transitions status to `completed`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ShiftResponseDto })
  @ApiBearerAuth()
  @UseGuards(StaffJwtGuard)
  @Post(':id/clock-out')
  clockOut(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.shiftsService.clockOut(id, staff);
  }
}
