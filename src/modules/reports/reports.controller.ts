import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { ReportsService } from './reports.service';
import {
  DashboardSummaryFilterDto,
  ReportsRangeDto,
  SalesReportFilterDto,
  TopProductsFilterDto,
} from './dto/reports-filter.dto';
import {
  DashboardSummaryDto,
  DeliveryStatsDto,
  KitchenStatsDto,
  SalesReportDto,
  StaffPerformanceDto,
  TopProductsReportDto,
} from './dto/reports-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest): {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
} {
  const user = req.user!;
  return user.sub_type === 'staff'
    ? {
        sub: user.sub,
        sub_type: 'staff',
        businessId: user.businessId,
        storeId: user.storeId,
      }
    : {
        sub: user.sub,
        sub_type: 'admin',
        businessId: user.businessId,
      };
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @ApiOperation({
    summary: 'Sales report',
    description:
      'Returns total revenue/orders/items for the period, plus per-bucket breakdowns ' +
      '(group by day, week, or month). Staff are auto-scoped to their store.',
  })
  @ApiOkResponse({ type: SalesReportDto })
  @Get('sales')
  sales(@Req() req: AuthedRequest, @Query() filter: SalesReportFilterDto) {
    return this.service.getSalesReport(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Staff performance',
    description:
      'For each staff member, returns orders processed, sales attributed, and hours ' +
      'worked from completed shifts.',
  })
  @ApiOkResponse({ type: StaffPerformanceDto })
  @Get('staff-performance')
  staffPerformance(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getStaffPerformance(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Kitchen stats',
    description:
      'Kitchen throughput metrics: orders served, average prep time (creation → ready), ' +
      'items per hour, busiest hour-of-day, and current in-flight count.',
  })
  @ApiOkResponse({ type: KitchenStatsDto })
  @Get('kitchen')
  kitchen(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getKitchenStats(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Delivery stats',
    description:
      'Delivery success/failure totals, average pickup-to-delivered time, and per-rider ' +
      'breakdown.',
  })
  @ApiOkResponse({ type: DeliveryStatsDto })
  @Get('delivery')
  delivery(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getDeliveryStats(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Dashboard summary',
    description:
      'Today-snapshot KPIs plus customer/loyalty/cash-session aggregates and a yesterday ' +
      'revenue baseline so the UI can render a delta against the same window yesterday.',
  })
  @ApiOkResponse({ type: DashboardSummaryDto })
  @Get('dashboard')
  dashboard(@Req() req: AuthedRequest, @Query() filter: DashboardSummaryFilterDto) {
    return this.service.getDashboardSummary(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Top products',
    description:
      'Best-selling products by revenue inside the date range. Joins order_items to ' +
      'orders to capture units, distinct orders, and revenue per product.',
  })
  @ApiOkResponse({ type: TopProductsReportDto })
  @Get('top-products')
  topProducts(
    @Req() req: AuthedRequest,
    @Query() filter: TopProductsFilterDto,
  ) {
    return this.service.getTopProducts(actorFrom(req), filter);
  }
}
