import { Workbook, Worksheet } from 'exceljs';
import PDFDocument from 'pdfkit';
import type {
  FoodCostReportDto,
  SalesReportDto,
  StockReportDto,
  TopProductsReportDto,
  WasteReportDto,
} from './dto/reports-response.dto';

export type ExportType =
  | 'sales'
  | 'top-products'
  | 'food-cost'
  | 'waste'
  | 'stock';

export type ExportFormat = 'xlsx' | 'pdf';

interface ExportMeta {
  storeName?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Column descriptor used by both renderers. */
interface TableColumn {
  key: string;
  header: string;
  width?: number;
  money?: boolean;
}

/** A logical "table" inside a report. */
interface ReportTable {
  /** Sheet name in xlsx; section heading in pdf. */
  title: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/** The intermediate shape both renderers consume. One per report type. */
interface ReportShape {
  /** Document title (e.g. "Sales Report"). */
  title: string;
  /** Filename slug (e.g. "sales"). */
  slug: string;
  /** Key/value summary on the cover sheet / first PDF section. */
  summary: Array<[string, string | number]>;
  /** Detail tables — at least one. */
  tables: ReportTable[];
}

/**
 * Single entry-point that turns a report DTO into either an xlsx workbook or
 * a PDF document. The DTO-to-shape conversion lives in `toShape`; rendering
 * lives in `renderXlsx` / `renderPdf`. Adding a new format only touches the
 * render step.
 */
export class ReportsExporter {
  async export(
    type: ExportType,
    report:
      | SalesReportDto
      | TopProductsReportDto
      | FoodCostReportDto
      | WasteReportDto
      | StockReportDto,
    meta: ExportMeta,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const shape = this.toShape(type, report);
    const filename = this.buildFilename(shape.slug, meta, format);
    if (format === 'pdf') {
      const buffer = await this.renderPdf(shape, meta);
      return {
        buffer,
        filename,
        contentType: 'application/pdf',
      };
    }
    const buffer = await this.renderXlsx(shape, meta);
    return {
      buffer,
      filename,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ─── DTO → ReportShape ───────────────────────────────────────────────

  private toShape(
    type: ExportType,
    report:
      | SalesReportDto
      | TopProductsReportDto
      | FoodCostReportDto
      | WasteReportDto
      | StockReportDto,
  ): ReportShape {
    switch (type) {
      case 'sales':
        return this.shapeSales(report as SalesReportDto);
      case 'top-products':
        return this.shapeTopProducts(report as TopProductsReportDto);
      case 'food-cost':
        return this.shapeFoodCost(report as FoodCostReportDto);
      case 'waste':
        return this.shapeWaste(report as WasteReportDto);
      case 'stock':
        return this.shapeStock(report as StockReportDto);
    }
  }

  private shapeSales(r: SalesReportDto): ReportShape {
    return {
      title: 'Sales Report',
      slug: 'sales',
      summary: [
        ['Total revenue', r.totalRevenue],
        ['Total orders', r.totalOrders],
        ['Total items', r.totalItems],
        ['Average order value', r.averageOrderValue],
      ],
      tables: [
        {
          title: 'Buckets',
          columns: [
            { key: 'bucket', header: 'Bucket', width: 22 },
            { key: 'orders', header: 'Orders', width: 10 },
            { key: 'items', header: 'Items', width: 10 },
            { key: 'revenue', header: 'Revenue', width: 16, money: true },
          ],
          rows: r.buckets.map((b) => ({
            // Already a local-wall-clock label from the sales report; re-parsing
            // it through toISOString() would shift it back a day.
            bucket: b.bucket,
            orders: b.orders,
            items: b.items,
            revenue: b.revenue,
          })),
        },
        {
          title: 'By Channel',
          columns: [
            { key: 'channel', header: 'Channel', width: 22 },
            { key: 'revenue', header: 'Revenue', width: 16, money: true },
          ],
          rows: Object.entries(r.byChannel).map(([channel, revenue]) => ({
            channel,
            revenue,
          })),
        },
      ],
    };
  }

  private shapeTopProducts(r: TopProductsReportDto): ReportShape {
    return {
      title: 'Best Sellers',
      slug: 'best-sellers',
      summary: [
        ['Products', r.rows.length],
        ['Total units sold', r.rows.reduce((s, x) => s + x.unitsSold, 0)],
        ['Total revenue', r.rows.reduce((s, x) => s + x.revenue, 0)],
      ],
      tables: [
        {
          title: 'Top Products',
          columns: [
            { key: 'rank', header: 'Rank', width: 6 },
            { key: 'name', header: 'Product', width: 30 },
            { key: 'unitsSold', header: 'Units sold', width: 12 },
            { key: 'ordersCount', header: 'Orders', width: 10 },
            { key: 'revenue', header: 'Revenue', width: 14, money: true },
          ],
          rows: r.rows.map((x, i) => ({
            rank: i + 1,
            name: x.name,
            unitsSold: x.unitsSold,
            ordersCount: x.ordersCount,
            revenue: x.revenue,
          })),
        },
      ],
    };
  }

  private shapeFoodCost(r: FoodCostReportDto): ReportShape {
    return {
      title: 'Food Cost Analysis',
      slug: 'food-cost',
      summary: [
        ['Items tracked', r.itemsTracked],
        ['Units sold', r.unitsSold],
        ['Total cost', r.totalCost],
        ['Total revenue', r.totalRevenue],
        ['Food cost %', r.foodCostPct],
        ['Margin', r.margin],
      ],
      tables: [
        {
          title: 'By Category',
          columns: [
            { key: 'name', header: 'Category', width: 26 },
            { key: 'unitsSold', header: 'Units', width: 10 },
            { key: 'totalCost', header: 'Cost', width: 14, money: true },
            { key: 'totalRevenue', header: 'Revenue', width: 14, money: true },
            { key: 'margin', header: 'Margin', width: 14, money: true },
            { key: 'foodCostPct', header: 'FC %', width: 10 },
            { key: 'shareOfCost', header: 'Share %', width: 10 },
          ],
          rows: r.byCategory.map((c) => ({ ...c })),
        },
        {
          title: 'By Item',
          columns: [
            { key: 'name', header: 'Product', width: 28 },
            { key: 'categoryName', header: 'Category', width: 20 },
            { key: 'unitsSold', header: 'Units', width: 8 },
            { key: 'costPrice', header: 'Cost price', width: 12, money: true },
            { key: 'sellingPrice', header: 'Sell price', width: 12, money: true },
            { key: 'totalCost', header: 'Cost', width: 12, money: true },
            { key: 'totalRevenue', header: 'Revenue', width: 12, money: true },
            { key: 'margin', header: 'Margin', width: 12, money: true },
            { key: 'foodCostPct', header: 'FC %', width: 10 },
          ],
          rows: r.byItem.map((x) => ({ ...x, categoryName: x.categoryName ?? '' })),
        },
      ],
    };
  }

  private shapeWaste(r: WasteReportDto): ReportShape {
    return {
      title: 'Waste Management',
      slug: 'waste',
      summary: [
        ['Entries', r.entries],
        ['Total value', r.totalValue],
        ['Total quantity', r.totalQuantity],
        ['Waste %', r.wastePct],
        ['vs Previous %', r.vsPreviousPct],
      ],
      tables: [
        {
          title: 'By Reason',
          columns: [
            { key: 'reason', header: 'Reason', width: 22 },
            { key: 'entries', header: 'Entries', width: 10 },
            { key: 'totalQuantity', header: 'Total qty', width: 12 },
            { key: 'estimatedValue', header: 'Value', width: 14, money: true },
            { key: 'share', header: 'Share %', width: 10 },
          ],
          rows: r.byReason.map((x) => ({ ...x })),
        },
        {
          title: 'By Ingredient',
          columns: [
            { key: 'name', header: 'Ingredient', width: 26 },
            { key: 'unit', header: 'Unit', width: 8 },
            { key: 'entries', header: 'Entries', width: 10 },
            { key: 'totalQuantity', header: 'Total qty', width: 12 },
            { key: 'estimatedValue', header: 'Value', width: 14, money: true },
          ],
          rows: r.byIngredient.map((x) => ({ ...x })),
        },
        {
          title: 'Log',
          columns: [
            { key: 'createdAt', header: 'When', width: 20 },
            { key: 'ingredientName', header: 'Ingredient', width: 24 },
            { key: 'quantity', header: 'Qty', width: 8 },
            { key: 'unit', header: 'Unit', width: 8 },
            { key: 'estimatedValue', header: 'Value', width: 12, money: true },
            { key: 'reason', header: 'Reason', width: 18 },
            { key: 'staffName', header: 'Staff', width: 20 },
          ],
          rows: r.recent.map((x) => ({
            createdAt: new Date(x.createdAt).toISOString().replace('T', ' ').slice(0, 16),
            ingredientName: x.ingredientName,
            quantity: x.quantity,
            unit: x.unit,
            estimatedValue: x.estimatedValue,
            reason: x.reason ?? '',
            staffName: x.staffName ?? '',
          })),
        },
      ],
    };
  }

  private shapeStock(r: StockReportDto): ReportShape {
    return {
      title: 'Stock Report',
      slug: 'stock',
      summary: [
        ['Total items', r.totalItems],
        ['Total value', r.totalValue],
        ['Low stock', r.lowStockCount],
        ['Out of stock', r.outOfStockCount],
        ['Expiring soon (≤14d)', r.expiringCount],
      ],
      tables: [
        {
          title: 'Inventory',
          columns: [
            { key: 'name', header: 'Ingredient', width: 26 },
            { key: 'sku', header: 'SKU', width: 12 },
            { key: 'unit', header: 'Unit', width: 6 },
            { key: 'currentStock', header: 'Current', width: 10 },
            { key: 'minStock', header: 'Min', width: 8 },
            { key: 'costPerUnit', header: 'Cost / unit', width: 12, money: true },
            { key: 'value', header: 'Value', width: 14, money: true },
            { key: 'status', header: 'Status', width: 10 },
            { key: 'expiryDate', header: 'Expiry', width: 12 },
          ],
          rows: r.rows.map((x) => ({
            name: x.name,
            sku: x.sku ?? '',
            unit: x.unit,
            currentStock: x.currentStock,
            minStock: x.minStock,
            costPerUnit: x.costPerUnit,
            value: x.value,
            status: x.status,
            expiryDate: x.expiryDate ?? '',
          })),
        },
      ],
    };
  }

  // ─── xlsx renderer ───────────────────────────────────────────────────

  private async renderXlsx(
    shape: ReportShape,
    meta: ExportMeta,
  ): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'Mr. Jollof';

    const summary = wb.addWorksheet('Summary');
    summary.mergeCells('A1:B1');
    summary.getCell('A1').value = shape.title;
    summary.getCell('A1').font = { bold: true, size: 14 };
    if (meta.storeName) summary.getCell('A2').value = `Store: ${meta.storeName}`;
    if (meta.dateFrom || meta.dateTo)
      summary.getCell('A3').value =
        `Period: ${meta.dateFrom ?? '…'} → ${meta.dateTo ?? '…'}`;
    let row = 5;
    for (const [k, v] of shape.summary) {
      summary.getCell(`A${row}`).value = k;
      summary.getCell(`A${row}`).font = { bold: true };
      summary.getCell(`B${row}`).value = v;
      row += 1;
    }
    summary.getColumn(1).width = 26;
    summary.getColumn(2).width = 22;

    for (const table of shape.tables) {
      const ws = wb.addWorksheet(table.title.slice(0, 31));
      ws.columns = table.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width ?? 14,
        ...(c.money ? { style: { numFmt: '#,##0.00' } } : {}),
      }));
      this.styleXlsxHeader(ws);
      for (const r of table.rows) ws.addRow(r);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private styleXlsxHeader(ws: Worksheet) {
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };
    });
  }

  // ─── PDF renderer ────────────────────────────────────────────────────

  private async renderPdf(
    shape: ReportShape,
    meta: ExportMeta,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.pdfHeader(doc, shape.title, meta);
      this.pdfSummary(doc, shape.summary);
      for (const table of shape.tables) {
        this.pdfTable(doc, table);
      }

      doc.end();
    });
  }

  private pdfHeader(
    doc: PDFKit.PDFDocument,
    title: string,
    meta: ExportMeta,
  ) {
    doc.fillColor('#111').fontSize(18).font('Helvetica-Bold').text(title);
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').fillColor('#555');
    if (meta.storeName) doc.text(`Store: ${meta.storeName}`);
    if (meta.dateFrom || meta.dateTo)
      doc.text(`Period: ${meta.dateFrom ?? '…'} → ${meta.dateTo ?? '…'}`);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
    doc.moveDown();
  }

  private pdfSummary(
    doc: PDFKit.PDFDocument,
    rows: Array<[string, string | number]>,
  ) {
    if (rows.length === 0) return;
    doc.fillColor('#111').fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#222');
    const colWidth = 220;
    const leftX = doc.x;
    let y = doc.y;
    const lineH = 16;
    rows.forEach(([k, v], i) => {
      const x = leftX + (i % 3) * colWidth;
      if (i > 0 && i % 3 === 0) y += lineH;
      doc.font('Helvetica-Bold').text(`${k}:`, x, y, { continued: true, width: colWidth });
      doc
        .font('Helvetica')
        .text(` ${typeof v === 'number' ? this.fmtNumber(v) : v}`, { width: colWidth });
      // PDFKit moves y after each text call; reset to row baseline so the next
      // column in the same row aligns horizontally.
      doc.y = y;
    });
    doc.y = y + lineH + 6;
    doc.x = leftX;
    doc.moveDown();
  }

  private pdfTable(doc: PDFKit.PDFDocument, table: ReportTable) {
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalConfiguredWidth = table.columns.reduce(
      (s, c) => s + (c.width ?? 14),
      0,
    );
    // Map configured widths (in xlsx character units) onto the PDF's usable
    // pixel width proportionally.
    const widths = table.columns.map(
      (c) => ((c.width ?? 14) / totalConfiguredWidth) * usable,
    );

    if (doc.y > doc.page.height - 120) doc.addPage();

    doc.fillColor('#111').fontSize(12).font('Helvetica-Bold').text(table.title);
    doc.moveDown(0.3);

    const headerY = doc.y;
    const rowH = 16;

    this.pdfDrawRow(
      doc,
      table.columns.map((c) => c.header),
      widths,
      headerY,
      rowH,
      { bold: true, fill: '#EFEFEF' },
    );

    let y = headerY + rowH;
    const leftX = doc.page.margins.left;
    for (const r of table.rows) {
      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        this.pdfDrawRow(
          doc,
          table.columns.map((c) => c.header),
          widths,
          y,
          rowH,
          { bold: true, fill: '#EFEFEF' },
        );
        y += rowH;
      }
      const cells = table.columns.map((c) => {
        const raw = r[c.key];
        if (raw == null || raw === '') return '';
        if (c.money && typeof raw === 'number') return this.fmtNumber(raw);
        if (typeof raw === 'number') return this.fmtNumber(raw);
        return String(raw);
      });
      this.pdfDrawRow(doc, cells, widths, y, rowH, {});
      y += rowH;
    }
    doc.x = leftX;
    doc.y = y + 8;
    doc.moveDown();
  }

  private pdfDrawRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    widths: number[],
    y: number,
    height: number,
    opts: { bold?: boolean; fill?: string },
  ) {
    const leftX = doc.page.margins.left;
    if (opts.fill) {
      doc
        .save()
        .rect(leftX, y, widths.reduce((s, w) => s + w, 0), height)
        .fill(opts.fill)
        .restore();
    }
    doc.fillColor('#222').fontSize(9);
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
    let x = leftX;
    cells.forEach((value, i) => {
      doc.text(value, x + 4, y + 4, {
        width: widths[i] - 8,
        height: height - 4,
        lineBreak: false,
        ellipsis: true,
      });
      x += widths[i];
    });
  }

  private fmtNumber(n: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  }

  // ─── filename ────────────────────────────────────────────────────────

  private buildFilename(
    slug: string,
    meta: ExportMeta,
    format: ExportFormat,
  ): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const range =
      meta.dateFrom && meta.dateTo
        ? `_${meta.dateFrom}_to_${meta.dateTo}`
        : meta.dateFrom
          ? `_${meta.dateFrom}`
          : '';
    return `${slug}${range}_${stamp}.${format}`;
  }
}
