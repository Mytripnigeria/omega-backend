import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @ApiOperation({
    summary: 'Combined bookings statistics',
    description: 'Aggregated reservation + event stats for the business (or scoped store).',
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @Get('stats')
  stats(
    @BusinessId() businessId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.getCombinedStats(businessId, storeId);
  }

  @ApiOperation({
    summary: 'Calendar feed',
    description:
      'Returns reservations and events for a date range, plus a unified `feed` array sorted by date+time.',
  })
  @ApiQuery({ name: 'dateFrom', example: '2026-05-01' })
  @ApiQuery({ name: 'dateTo', example: '2026-05-31' })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @Get('calendar')
  calendar(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }
    return this.service.getCalendar(businessId, dateFrom, dateTo, storeId);
  }
}
