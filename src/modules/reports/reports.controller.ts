import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { ReportsService } from './reports.service';
import { ExportFormat, ExportType, ReportsExporter } from './reports.exporter';
import {
  DashboardSummaryFilterDto,
  ReportsRangeDto,
  SalesReportFilterDto,
  TopProductsFilterDto,
} from './dto/reports-filter.dto';
import {
  DashboardSummaryDto,
  DeliveryStatsDto,
  FoodCostReportDto,
  KitchenStatsDto,
  SalesReportDto,
  StaffPerformanceDto,
  StockReportDto,
  TopProductsReportDto,
  WasteReportDto,
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
  constructor(
    private readonly service: ReportsService,
    private readonly exporter: ReportsExporter,
  ) {}

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

  @ApiOperation({
    summary: 'Food cost analysis',
    description:
      'Food cost % computed from sold items: ' +
      '(sum of qty × product cost price) / (sum of order-item subtotals) × 100. ' +
      'Only COMPLETED orders count. Returns overall stats plus a breakdown by ' +
      'category and by individual item.',
  })
  @ApiOkResponse({ type: FoodCostReportDto })
  @Get('food-cost')
  foodCost(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getFoodCostReport(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Waste analysis',
    description:
      'Aggregates ingredient-movement rows tagged as WASTE (logged from the workstation Outstore page). ' +
      'Returns stats, breakdowns by reason and by ingredient, and the recent log.',
  })
  @ApiOkResponse({ type: WasteReportDto })
  @Get('waste')
  waste(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getWasteReport(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Stock report',
    description:
      'Inventory snapshot from IngredientEntity: total value, status counts, expiring-soon count, and per-ingredient rows.',
  })
  @ApiOkResponse({ type: StockReportDto })
  @Get('stock')
  stock(@Req() req: AuthedRequest, @Query() filter: ReportsRangeDto) {
    return this.service.getStockReport(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Export a report as Excel (.xlsx) or PDF',
    description:
      'Streams the requested report in the requested format. Supported types: ' +
      '`sales`, `top-products`, `food-cost`, `waste`, `stock`. Supported formats: ' +
      '`xlsx` (default) and `pdf`. The `storeName` query param (optional) is only ' +
      'used as a label on the document.',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiQuery({
    name: 'type',
    enum: ['sales', 'top-products', 'food-cost', 'waste', 'stock'],
  })
  @ApiQuery({
    name: 'format',
    enum: ['xlsx', 'pdf'],
    required: false,
  })
  @ApiQuery({ name: 'storeId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'storeName', required: false })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'dateTo', required: false, example: '2026-06-30' })
  @Get('export')
  async export(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('type') type: string,
    @Query() filter: ReportsRangeDto,
    @Query('format') formatQuery?: string,
    @Query('storeName') storeName?: string,
  ): Promise<void> {
    const allowedTypes: ExportType[] = [
      'sales',
      'top-products',
      'food-cost',
      'waste',
      'stock',
    ];
    if (!allowedTypes.includes(type as ExportType)) {
      throw new BadRequestException(
        `Unsupported report type "${type}". Use one of: ${allowedTypes.join(', ')}.`,
      );
    }
    const format: ExportFormat =
      formatQuery === 'pdf' ? 'pdf' : formatQuery === 'xlsx' || !formatQuery ? 'xlsx' : 'xlsx';
    if (formatQuery && formatQuery !== 'pdf' && formatQuery !== 'xlsx') {
      throw new BadRequestException(
        `Unsupported format "${formatQuery}". Use "xlsx" or "pdf".`,
      );
    }

    const actor = actorFrom(req);
    const meta = {
      storeName,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
    };

    let report:
      | Awaited<ReturnType<ReportsService['getSalesReport']>>
      | Awaited<ReturnType<ReportsService['getTopProducts']>>
      | Awaited<ReturnType<ReportsService['getFoodCostReport']>>
      | Awaited<ReturnType<ReportsService['getWasteReport']>>
      | Awaited<ReturnType<ReportsService['getStockReport']>>;
    switch (type as ExportType) {
      case 'sales':
        report = await this.service.getSalesReport(actor, {
          ...filter,
          groupBy: 'day',
        });
        break;
      case 'top-products':
        report = await this.service.getTopProducts(actor, {
          ...filter,
          limit: 50,
        });
        break;
      case 'food-cost':
        report = await this.service.getFoodCostReport(actor, filter);
        break;
      case 'waste':
        report = await this.service.getWasteReport(actor, filter);
        break;
      case 'stock':
        report = await this.service.getStockReport(actor, filter);
        break;
    }

    const payload = await this.exporter.export(
      type as ExportType,
      report,
      meta,
      format,
    );

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${payload.filename}"`,
    );
    res.setHeader('Content-Length', String(payload.buffer.byteLength));
    res.end(payload.buffer);
  }
}
