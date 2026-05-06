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
import { EventsService } from './events.service';
import {
  CreateEventDto,
  EventFilterDto,
  RecordPaymentDto,
  UpdateEventDto,
} from './dto/event.dto';
import { EventResponseDto } from './dto/event-response.dto';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @ApiOperation({ summary: 'Event statistics' })
  @Get('stats')
  stats(
    @BusinessId() businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.getStats(businessId, storeId);
  }

  @ApiOperation({ summary: 'List events' })
  @Get()
  list(@BusinessId() businessId: string, @Query() filter: EventFilterDto) {
    return this.service.findAll(businessId, filter);
  }

  @ApiOperation({ summary: 'Get an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EventResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Create an event' })
  @ApiCreatedResponse({ type: EventResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateEventDto) {
    return this.service.create(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Update an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EventResponseDto })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.service.update(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Confirm an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Post(':id/confirm')
  confirm(@Req() req: Request, @Param('id') id: string) {
    return this.service.confirm(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Start an event (mark in progress)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Post(':id/start')
  start(@Req() req: Request, @Param('id') id: string) {
    return this.service.start(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Complete an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Post(':id/complete')
  complete(@Req() req: Request, @Param('id') id: string) {
    return this.service.complete(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Cancel an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Post(':id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.service.cancel(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Record a payment against an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EventResponseDto })
  @Post(':id/payments')
  recordPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.service.recordPayment(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Delete an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.remove(req.user as AdminJwtPayload, id);
  }
}
