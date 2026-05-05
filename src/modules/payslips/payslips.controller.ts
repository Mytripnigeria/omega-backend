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
import { PayslipsService } from './payslips.service';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { UpdatePayslipDto } from './dto/update-payslip.dto';
import { PayslipFilterDto } from './dto/payslip-filter.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { PayslipResponseDto } from './dto/payslip-response.dto';

@ApiTags('payslips')
@Controller('payslips')
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @ApiOperation({
    summary: 'My payslips',
    description:
      'Staff-authenticated. Returns the authenticated staff member\'s own payslips, newest first. ' +
      'Use query params to filter by period or status.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/PayslipResponseDto' } },
        total: { type: 'integer', example: 6 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(StaffJwtGuard)
  @Get('my')
  getMyPayslips(
    @CurrentStaff() staff: StaffJwtPayload,
    @Query() filter: PayslipFilterDto,
  ) {
    return this.payslipsService.findMyPayslips(staff.sub, filter);
  }

  @ApiOperation({ summary: 'Create a payslip', description: 'Admin-only. Creates a draft payslip for a staff member.' })
  @ApiCreatedResponse({ type: PayslipResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreatePayslipDto) {
    return this.payslipsService.create(dto);
  }

  @ApiOperation({ summary: 'List payslips', description: 'Admin-only. Returns paginated payslips.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/PayslipResponseDto' } },
        total: { type: 'integer', example: 24 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() filter: PayslipFilterDto) {
    return this.payslipsService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single payslip' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayslipResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payslipsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a payslip', description: 'Admin-only. Only draft payslips can be updated.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayslipResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayslipDto) {
    return this.payslipsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a payslip', description: 'Admin-only. Only draft payslips can be deleted.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.payslipsService.remove(id);
  }

  @ApiOperation({
    summary: 'Approve a payslip',
    description: 'Admin-only. Transitions status: `draft` → `pending` → `approved`. Returns the updated payslip.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayslipResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.payslipsService.approve(id);
  }

  @ApiOperation({
    summary: 'Mark a payslip as paid',
    description: 'Admin-only. Transitions status to `paid` and records the payment method and date.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PayslipResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.payslipsService.markPaid(id, dto);
  }
}
