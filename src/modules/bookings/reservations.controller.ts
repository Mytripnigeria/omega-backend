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
  Req,
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
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { ReservationsService } from './reservations.service';
import {
  CancelReservationDto,
  CreateReservationDto,
  ReservationFilterDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @ApiOperation({ summary: 'Reservation statistics' })
  @Get('stats')
  stats(
    @BusinessId() businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.getStats(businessId, storeId);
  }

  @ApiOperation({ summary: 'List reservations' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: ReservationFilterDto,
  ) {
    return this.service.findAll(businessId, filter);
  }

  @ApiOperation({ summary: 'Get a reservation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Create a reservation' })
  @ApiCreatedResponse({ type: ReservationResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateReservationDto) {
    return this.service.create(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Update a reservation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.service.update(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Confirm a reservation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Post(':id/confirm')
  confirm(@Req() req: Request, @Param('id') id: string) {
    return this.service.confirm(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Mark a reservation as seated' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Post(':id/seat')
  seat(@Req() req: Request, @Param('id') id: string) {
    return this.service.seat(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Mark a reservation as completed' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Post(':id/complete')
  complete(@Req() req: Request, @Param('id') id: string) {
    return this.service.complete(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Mark a reservation as no-show' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Post(':id/no-show')
  noShow(@Req() req: Request, @Param('id') id: string) {
    return this.service.noShow(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @Post(':id/cancel')
  cancel(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.service.cancel(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Delete a reservation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.remove(req.user as AdminJwtPayload, id);
  }
}
