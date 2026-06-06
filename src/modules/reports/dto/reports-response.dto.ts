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

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { pos: 84000, website: 60000, phone: 12000 },
    description: 'Revenue split by order channel for this bucket',
  })
  byChannel: Record<string, number>;
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

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { pos: 1200000, website: 540000, phone: 120500 },
    description: 'Total revenue split by channel across the entire range',
  })
  byChannel: Record<string, number>;
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

  @ApiProperty({
    example: 152000,
    description: 'Revenue from the same hour-window yesterday — used for delta indicator',
  })
  yesterdayRevenue: number;

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

  @ApiProperty({ example: 12, description: 'New customers (created today)' })
  newCustomersToday: number;

  @ApiProperty({ example: 1240, description: 'Total customer count' })
  totalCustomers: number;

  @ApiProperty({
    example: 142,
    description: 'Loyalty program members (customers with points > 0)',
  })
  loyaltyMembers: number;

  @ApiProperty({
    example: 7,
    description: 'Cash sessions still open right now',
  })
  openCashSessions: number;
}

export class TopProductRowDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'Jollof Rice (Large)' })
  name: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  categoryId: string | null;

  @ApiProperty({ example: 84 })
  unitsSold: number;

  @ApiProperty({ example: 18 })
  ordersCount: number;

  @ApiProperty({ example: 378000 })
  revenue: number;
}

export class FoodCostCategoryRowDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  categoryId: string | null;

  @ApiProperty({ example: 'Proteins' })
  name: string;

  @ApiProperty({ example: 84, description: 'Units of products in this category sold in the period.' })
  unitsSold: number;

  @ApiProperty({ example: 252000, description: 'Cost basis (sum of qty × product cost price).' })
  totalCost: number;

  @ApiProperty({ example: 420000, description: 'Revenue basis (sum of order-item subtotals — what customers actually paid).' })
  totalRevenue: number;

  @ApiProperty({ example: 60, description: 'Food cost % = totalCost / totalRevenue × 100. 0 when totalRevenue is 0.' })
  foodCostPct: number;

  @ApiProperty({ example: 168000, description: 'Gross margin = totalRevenue − totalCost.' })
  margin: number;

  @ApiProperty({ example: 30, description: 'Share of total food cost across the period (0–100).' })
  shareOfCost: number;
}

export class FoodCostItemRowDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'Jollof Rice (Large)' })
  name: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  categoryId: string | null;

  @ApiPropertyOptional({ nullable: true })
  categoryName: string | null;

  @ApiProperty({ example: 84 })
  unitsSold: number;

  @ApiProperty({ example: 3500 })
  costPrice: number;

  @ApiProperty({ example: 4500 })
  sellingPrice: number;

  @ApiProperty({ example: 294000 })
  totalCost: number;

  @ApiProperty({ example: 378000 })
  totalRevenue: number;

  @ApiProperty({ example: 77.78 })
  foodCostPct: number;

  @ApiProperty({ example: 84000 })
  margin: number;
}

export class FoodCostReportDto {
  @ApiProperty({ example: 124, description: 'Distinct sold items in the period.' })
  itemsTracked: number;

  @ApiProperty({ example: 462, description: 'Total units of products sold in the period.' })
  unitsSold: number;

  @ApiProperty({ example: 1248500 })
  totalCost: number;

  @ApiProperty({ example: 1860500 })
  totalRevenue: number;

  @ApiProperty({ example: 67.1 })
  foodCostPct: number;

  @ApiProperty({ example: 612000, description: 'Gross margin across the period (revenue − cost).' })
  margin: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 30,
    description: 'Optional benchmark target food cost % the merchant set (not implemented yet — reserved).',
  })
  targetPct: number | null;

  @ApiProperty({ type: [FoodCostCategoryRowDto] })
  byCategory: FoodCostCategoryRowDto[];

  @ApiProperty({ type: [FoodCostItemRowDto] })
  byItem: FoodCostItemRowDto[];
}

export class WasteReasonRowDto {
  @ApiProperty({ example: 'Spoilage' })
  reason: string;

  @ApiProperty({ example: 12, description: 'Number of waste movements with this reason.' })
  entries: number;

  @ApiProperty({ example: 35.2 })
  totalQuantity: number;

  @ApiProperty({ example: 18000 })
  estimatedValue: number;

  @ApiProperty({ example: 42, description: 'Share of total waste cost (0–100).' })
  share: number;
}

export class WasteIngredientRowDto {
  @ApiProperty({ format: 'uuid' })
  ingredientId: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  name: string;

  @ApiProperty({ example: 'kg' })
  unit: string;

  @ApiProperty({ example: 5 })
  entries: number;

  @ApiProperty({ example: 12.5 })
  totalQuantity: number;

  @ApiProperty({ example: 15000 })
  estimatedValue: number;
}

export class WasteLogRowDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ingredientId: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  ingredientName: string;

  @ApiProperty({ example: 'kg' })
  unit: string;

  @ApiProperty({
    example: 2.5,
    description: 'Absolute quantity wasted (positive number).',
  })
  quantity: number;

  @ApiProperty({ example: 3000, description: 'Estimated cost = quantity × costPerUnit at the time of the movement.' })
  estimatedValue: number;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  staffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  staffName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export class WasteReportDto {
  @ApiProperty({ example: 42, description: 'Number of waste entries in the period.' })
  entries: number;

  @ApiProperty({ example: 124500, description: 'Total estimated cost of wasted ingredients.' })
  totalValue: number;

  @ApiProperty({ example: 287.5, description: 'Total absolute quantity wasted (unit-agnostic sum).' })
  totalQuantity: number;

  @ApiProperty({
    example: 3.2,
    description:
      'Waste % = totalValue / total ingredient inventory value in the period. 0 when inventory value is unknown.',
  })
  wastePct: number;

  @ApiProperty({
    example: -15,
    description:
      'Percentage change in total waste value vs the equivalent previous period (negative = improvement).',
  })
  vsPreviousPct: number;

  @ApiProperty({ type: [WasteReasonRowDto] })
  byReason: WasteReasonRowDto[];

  @ApiProperty({ type: [WasteIngredientRowDto] })
  byIngredient: WasteIngredientRowDto[];

  @ApiProperty({ type: [WasteLogRowDto] })
  recent: WasteLogRowDto[];
}

export class TopProductsReportDto {
  @ApiProperty({ type: [TopProductRowDto] })
  rows: TopProductRowDto[];
}

export type StockStatus = 'good' | 'low' | 'critical' | 'out';

export class StockReportRowDto {
  @ApiProperty({ format: 'uuid' })
  ingredientId: string;

  @ApiProperty({ example: 'Long Grain Rice' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  sku: string | null;

  @ApiProperty({ example: 'kg' })
  unit: string;

  @ApiProperty({ example: 35.5 })
  currentStock: number;

  @ApiProperty({ example: 10 })
  minStock: number;

  @ApiProperty({ example: 1200, description: 'Cost per unit in NGN.' })
  costPerUnit: number;

  @ApiProperty({ example: 42600, description: 'currentStock × costPerUnit.' })
  value: number;

  @ApiProperty({
    enum: ['good', 'low', 'critical', 'out'],
    description:
      '`out` = 0, `critical` ≤ half of min, `low` ≤ min, otherwise `good`.',
  })
  status: StockStatus;

  @ApiPropertyOptional({ nullable: true })
  expiryDate: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastRestocked: string | null;
}

export class StockReportDto {
  @ApiProperty({ example: 124 })
  totalItems: number;

  @ApiProperty({ example: 4_528_500, description: 'Sum of currentStock × costPerUnit across all ingredients.' })
  totalValue: number;

  @ApiProperty({ example: 8, description: 'Ingredients at or below minStock.' })
  lowStockCount: number;

  @ApiProperty({ example: 3, description: 'Ingredients with currentStock = 0.' })
  outOfStockCount: number;

  @ApiProperty({
    example: 12,
    description: 'Ingredients with a non-null expiryDate within the next 14 days.',
  })
  expiringCount: number;

  @ApiProperty({ type: [StockReportRowDto] })
  rows: StockReportRowDto[];
}
