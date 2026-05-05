import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesReportBucketDto {
  @ApiProperty({ example: '2026-05-01' })
  bucket: string;

  @ApiProperty({ example: 12 })
  orders: number;

  @ApiProperty({ example: 48 })
  items: number;

  @ApiProperty({ example: 156000 })
  revenue: number;
}

export class SalesReportDto {
  @ApiProperty({ example: 124 })
  totalOrders: number;

  @ApiProperty({ example: 462 })
  totalItems: number;

  @ApiProperty({ example: 1860500 })
  totalRevenue: number;

  @ApiProperty({ example: 15003.4 })
  averageOrderValue: number;

  @ApiProperty({ type: [SalesReportBucketDto] })
  buckets: SalesReportBucketDto[];
}

export class StaffPerformanceRowDto {
  @ApiProperty({ format: 'uuid' })
  staffId: string;

  @ApiProperty({ example: 'Amaka Okafor' })
  staffName: string;

  @ApiProperty({ example: 42 })
  ordersProcessed: number;

  @ApiProperty({ example: 612000 })
  salesAttributed: number;

  @ApiProperty({ example: 38.5, description: 'Hours worked across completed shifts in range' })
  hoursWorked: number;
}

export class StaffPerformanceDto {
  @ApiProperty({ type: [StaffPerformanceRowDto] })
  rows: StaffPerformanceRowDto[];
}

export class KitchenStatsDto {
  @ApiProperty({ example: 124 })
  ordersServed: number;

  @ApiProperty({ example: 14.2, description: 'Average minutes from order creation to ready (kitchen prep time)' })
  averagePrepMinutes: number;

  @ApiProperty({ example: 38, description: 'Items per hour during open hours' })
  itemsPerHour: number;

  @ApiPropertyOptional({ example: 19, nullable: true, description: 'Hour-of-day with the most orders (0-23)' })
  busiestHour: number | null;

  @ApiProperty({ example: 4, description: 'Currently in-flight orders (preparing or ready)' })
  inflightCount: number;
}

export class DeliveryStatsDto {
  @ApiProperty({ example: 84 })
  totalDeliveries: number;

  @ApiProperty({ example: 78 })
  delivered: number;

  @ApiProperty({ example: 4 })
  failed: number;

  @ApiProperty({ example: 92.9, description: 'Delivered / total — percentage' })
  successRate: number;

  @ApiProperty({ example: 23.4, description: 'Average minutes from pickup to delivered' })
  averageDeliveryMinutes: number;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        riderStaffId: { type: 'string', format: 'uuid' },
        riderName: { type: 'string' },
        delivered: { type: 'integer' },
        failed: { type: 'integer' },
      },
    },
  })
  byRider: Array<{
    riderStaffId: string;
    riderName: string | null;
    delivered: number;
    failed: number;
  }>;
}

export class DashboardSummaryDto {
  @ApiProperty({ example: 24 })
  todayOrders: number;

  @ApiProperty({ example: 184500 })
  todayRevenue: number;

  @ApiProperty({ example: 5 })
  openOrders: number;

  @ApiProperty({ example: 3 })
  activeShifts: number;

  @ApiProperty({ example: 2 })
  lowStockCount: number;

  @ApiProperty({ example: 1 })
  pendingExpenses: number;

  @ApiProperty({ example: 4, description: 'Deliveries currently in_transit' })
  deliveriesInTransit: number;
}
