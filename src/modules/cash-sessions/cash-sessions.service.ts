import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import { CashSessionEntity } from './entities/cash-session.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { StoreEntity } from '../store/entities/store.entity';
import {
  CashSessionFilterDto,
  CloseCashSessionDto,
  OpenCashSessionDto,
  ReviewCashSessionDto,
} from './dto/cash-session-dto';
import {
  CashSessionResponseDto,
  CashSessionStatsDto,
} from './dto/cash-session-response.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

@Injectable()
export class CashSessionsService {
  constructor(
    @InjectRepository(CashSessionEntity)
    private readonly repo: Repository<CashSessionEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  async open(
    actor: ActorContext,
    dto: OpenCashSessionDto,
  ): Promise<CashSessionResponseDto> {
    if (actor.sub_type !== 'staff' || !actor.storeId) {
      throw new ForbiddenException('Only staff can open a cash session');
    }
    // No more than one open session per staff in the same store.
    const existing = await this.repo.findOne({
      where: {
        staffId: actor.sub,
        storeId: actor.storeId,
        status: 'open',
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have an open cash session — close it before opening a new one',
      );
    }

    const staff = await this.staffRepo.findOne({ where: { id: actor.sub } });
    const staffName = staff
      ? `${staff.firstName} ${staff.lastName}`.trim()
      : actor.actorName ?? 'Staff';

    const session = this.repo.create({
      businessId: actor.businessId,
      storeId: actor.storeId,
      staffId: actor.sub,
      staffName,
      counterName: dto.counterName ?? null,
      staffsJoined: [staffName],
      staffIdsJoined: [actor.sub],
      shiftId: dto.shiftId ?? null,
      status: 'open',
      openedAt: new Date(),
      openingFloat: dto.openingFloat,
      notes: dto.notes ?? null,
    });
    const saved = await this.repo.save(session);

    this.activityLog.record({
      actorType: 'staff',
      actorId: actor.sub,
      actorName: staffName,
      action: 'cash_session.opened',
      businessId: actor.businessId,
      storeId: actor.storeId,
      resourceType: 'cash_session',
      resourceId: saved.id,
      metadata: {
        openingFloat: Number(saved.openingFloat),
        shiftId: saved.shiftId,
      },
    });

    return CashSessionResponseDto.from(saved);
  }

  async myActive(actor: ActorContext): Promise<CashSessionResponseDto | null> {
    if (actor.sub_type !== 'staff') return null;
    // The staff's own open session takes precedence.
    let session = await this.repo.findOne({
      where: { staffId: actor.sub, status: 'open' },
      order: { openedAt: 'DESC' },
    });
    // Otherwise, surface an open register on their store that they've joined,
    // so a cashier who joined a colleague's register can use the POS.
    if (!session && actor.storeId) {
      const open = await this.repo.find({
        where: { storeId: actor.storeId, status: 'open' },
        order: { openedAt: 'DESC' },
      });
      session =
        open.find((s) => (s.staffIdsJoined ?? []).includes(actor.sub)) ?? null;
    }
    return session ? CashSessionResponseDto.from(session) : null;
  }

  /**
   * Open registers on the staff's store that they can join. Excludes any
   * register they already belong to (opener or already-joined).
   */
  async storeActive(actor: ActorContext): Promise<CashSessionResponseDto[]> {
    if (actor.sub_type !== 'staff' || !actor.storeId) return [];
    const open = await this.repo.find({
      where: { storeId: actor.storeId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
    const joinable = open.filter(
      (s) =>
        s.staffId !== actor.sub &&
        !(s.staffIdsJoined ?? []).includes(actor.sub),
    );
    return joinable.map((s) => CashSessionResponseDto.from(s));
  }

  /**
   * Join an open register on the staff's own store. Adds the staff to the
   * register's membership so they can transact on it and so `myActive`
   * resolves it for them.
   */
  async join(
    actor: ActorContext,
    id: string,
  ): Promise<CashSessionResponseDto> {
    if (actor.sub_type !== 'staff' || !actor.storeId) {
      throw new ForbiddenException('Only staff can join a register');
    }
    const session = await this.findEntity(actor, id);
    if (session.status !== 'open') {
      throw new BadRequestException('This register is no longer open');
    }
    if (session.storeId !== actor.storeId) {
      throw new ForbiddenException('That register belongs to another store');
    }

    const staff = await this.staffRepo.findOne({ where: { id: actor.sub } });
    const staffName = staff
      ? `${staff.firstName} ${staff.lastName}`.trim()
      : actor.actorName ?? 'Staff';

    const idsJoined = new Set(session.staffIdsJoined ?? []);
    idsJoined.add(actor.sub);
    session.staffIdsJoined = Array.from(idsJoined);
    if (!(session.staffsJoined ?? []).includes(staffName)) {
      session.staffsJoined = [...(session.staffsJoined ?? []), staffName];
    }
    const saved = await this.repo.save(session);

    this.activityLog.record({
      actorType: 'staff',
      actorId: actor.sub,
      actorName: staffName,
      action: 'cash_session.joined',
      businessId: actor.businessId,
      storeId: actor.storeId,
      resourceType: 'cash_session',
      resourceId: saved.id,
      metadata: { counterName: saved.counterName },
    });

    return CashSessionResponseDto.from(saved);
  }

  /** Look up an open session for staff/store — used by ShiftsService.clockOut to gate. */
  async findActiveForStaff(
    staffId: string,
    storeId: string,
  ): Promise<CashSessionEntity | null> {
    return this.repo.findOne({
      where: { staffId, storeId, status: 'open' },
    });
  }

  /**
   * Sums what the register *should* hold, per tender, from the order ledger:
   * every payment taken between the session opening and `upTo` by the opener
   * or any staff who joined. Extracted from close() so an OPEN session can be
   * queried live — the workstation needs to show the cashier what's expected
   * before they count the drawer.
   */
  async computeExpected(
    session: CashSessionEntity,
    upTo: Date = new Date(),
  ): Promise<{
    expectedCash: number;
    expectedCard: number;
    expectedMobile: number;
    expectedTotal: number;
  }> {
    // Sales rung up by the opener AND any staff who joined the register all
    // count toward this register's expected totals.
    const sessionStaffIds = Array.from(
      new Set([session.staffId, ...(session.staffIdsJoined ?? [])]),
    );
    const closedAt = upTo;

    const cashRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('o.staffId IN (:...staffIds)', { staffIds: sessionStaffIds })
      .andWhere('o.paymentChannel = :ch', { ch: 'cash' })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    // Card/mobile buckets also count store-scoped online orders that were
    // paid during the window with no staff attribution (storefront paystack/
    // wallet auto-payments never touch a cashier). Cash stays staff-only —
    // unattributed cash never entered this drawer. Caveat (accepted): when
    // two registers are open concurrently in one store, both closes will
    // include the same online rows.
    const cardRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('(o.staffId IN (:...staffIds) OR o.staffId IS NULL)', {
        staffIds: sessionStaffIds,
      })
      .andWhere('o.paymentChannel IN (:...chs)', { chs: ['card', 'paystack'] })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    const mobileRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('(o.staffId IN (:...staffIds) OR o.staffId IS NULL)', {
        staffIds: sessionStaffIds,
      })
      .andWhere('o.paymentChannel IN (:...chs)', { chs: ['wallet', 'points'] })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    // The float is part of the cash the drawer should physically hold.
    const expectedCash =
      Number(cashRow?.total ?? 0) + Number(session.openingFloat);
    const expectedCard = Number(cardRow?.total ?? 0);
    const expectedMobile = Number(mobileRow?.total ?? 0);

    return {
      expectedCash,
      expectedCard,
      expectedMobile,
      expectedTotal: expectedCash + expectedCard + expectedMobile,
    };
  }

  /** Live expected totals for a session the cashier is about to close. */
  async getExpected(actor: ActorContext, id: string) {
    const session = await this.findEntity(actor, id);
    return this.computeExpected(session);
  }

  async close(
    actor: ActorContext,
    id: string,
    dto: CloseCashSessionDto,
  ): Promise<CashSessionResponseDto> {
    const session = await this.findEntity(actor, id);
    if (session.status !== 'open') {
      throw new BadRequestException(
        `Cannot close session that is already ${session.status}`,
      );
    }
    if (actor.sub_type === 'staff' && session.staffId !== actor.sub) {
      throw new ForbiddenException('You can only close your own cash session');
    }

    // ---------- Compute expected from the order ledger ----------
    const closedAt = new Date();
    const { expectedCash, expectedCard, expectedMobile, expectedTotal } =
      await this.computeExpected(session, closedAt);

    // The counted amounts are whatever the cashier actually has in hand. Any
    // tender they didn't count falls back to the expected figure for that
    // tender rather than 0 — a cashier only physically counts the drawer, and
    // treating an uncounted card/transfer total as "0 collected" is what made
    // every close report a huge shortage.
    const counted = (v: number | undefined, fallback: number) =>
      v === undefined || v === null || Number.isNaN(Number(v))
        ? fallback
        : Number(v);
    const actualCash = counted(dto.actualCash, expectedCash);
    const actualCard = counted(dto.actualCard, expectedCard);
    const actualMobile = counted(dto.actualMobile, expectedMobile);
    const actualTotal = actualCash + actualCard + actualMobile;

    const difference = Math.round((actualTotal - expectedTotal) * 100) / 100;
    const reconciliationStatus: CashSessionEntity['reconciliationStatus'] =
      Math.abs(difference) < 0.01 ? 'balanced' : difference > 0 ? 'over' : 'short';

    session.status = 'closed';
    session.closedAt = closedAt;
    session.expectedCash = expectedCash;
    session.expectedCard = expectedCard;
    session.expectedMobile = expectedMobile;
    session.expectedTotal = expectedTotal;
    session.actualCash = actualCash;
    session.actualCard = actualCard;
    session.actualMobile = actualMobile;
    session.actualTotal = actualTotal;
    session.difference = difference;
    session.reconciliationStatus = reconciliationStatus;
    if (dto.notes !== undefined) session.notes = dto.notes ?? null;

    await this.repo.save(session);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName: actor.actorName ?? session.staffName,
      action: 'cash_session.closed',
      businessId: session.businessId,
      storeId: session.storeId,
      resourceType: 'cash_session',
      resourceId: session.id,
      metadata: {
        difference,
        reconciliationStatus,
        expectedTotal,
        actualTotal,
      },
    });

    return CashSessionResponseDto.from(session);
  }

  async review(
    actor: ActorContext,
    id: string,
    dto: ReviewCashSessionDto,
  ): Promise<CashSessionResponseDto> {
    if (actor.sub_type !== 'admin') {
      throw new ForbiddenException('Admin-only');
    }
    const session = await this.findEntity(actor, id);
    if (session.status !== 'closed') {
      throw new BadRequestException(
        `Only closed sessions can be reviewed (current: ${session.status})`,
      );
    }

    session.status = 'reviewed';
    session.reviewedAt = new Date();
    session.reviewedById = actor.sub;
    session.reviewedByName = actor.actorName ?? 'Admin';
    session.reviewNotes = dto.reviewNotes ?? null;
    await this.repo.save(session);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'cash_session.reviewed',
      businessId: session.businessId,
      storeId: session.storeId,
      resourceType: 'cash_session',
      resourceId: session.id,
      metadata: { notes: dto.reviewNotes ?? null },
    });

    return CashSessionResponseDto.from(session);
  }

  async findAll(
    actor: ActorContext,
    filter: CashSessionFilterDto,
  ): Promise<PaginatedResponseDto<CashSessionResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.businessId = :businessId', { businessId: actor.businessId })
      .orderBy('s.openedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('s.storeId = :storeId', { storeId: filter.storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('s.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.staffId) qb.andWhere('s.staffId = :staffId', { staffId: filter.staffId });
    if (filter.status) qb.andWhere('s.status = :status', { status: filter.status });
    if (filter.reconciliationStatus)
      qb.andWhere('s.reconciliationStatus = :rs', { rs: filter.reconciliationStatus });
    if (filter.dateFrom) qb.andWhere('s.openedAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo)
      qb.andWhere('s.openedAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, CashSessionResponseDto.from);
  }

  async findOne(actor: ActorContext, id: string): Promise<CashSessionResponseDto> {
    return CashSessionResponseDto.from(await this.findEntity(actor, id));
  }

  /** Deletes a register record (admin-only). */
  async remove(actor: ActorContext, id: string): Promise<void> {
    if (actor.sub_type !== 'admin') {
      throw new ForbiddenException('Admin-only');
    }
    const session = await this.findEntity(actor, id);
    await this.repo.delete(session.id);
    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'cash_session.deleted',
      businessId: session.businessId,
      storeId: session.storeId,
      resourceType: 'cash_session',
      resourceId: session.id,
      metadata: { counterName: session.counterName },
    });
  }

  private async findEntity(actor: ActorContext, id: string): Promise<CashSessionEntity> {
    const session = await this.repo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Cash session ${id} not found`);
    if (session.businessId !== actor.businessId) {
      throw new ForbiddenException('Cash session belongs to another business');
    }
    if (
      actor.sub_type === 'staff' &&
      actor.storeId &&
      session.storeId !== actor.storeId
    ) {
      throw new ForbiddenException('Cash session belongs to another store');
    }
    return session;
  }

  /**
   * Aggregates paid orders on a register and renders the Register Report PDF
   * (matches the sample: store, counter, opening/closing amounts, cash/POS
   * breakdown with counts, order grand total).
   */
  async generateReportPdf(
    actor: ActorContext,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const session = await this.findEntity(actor, id);
    const store = await this.storeRepo.findOne({
      where: { id: session.storeId },
    });
    const storeName = store?.name ?? 'Store';
    const until = session.closedAt ?? new Date();

    // Include sales from every staff member who joined the register, not
    // just the opener — mirrors the expected-totals computation in close().
    const sessionStaffIds = Array.from(
      new Set([session.staffId, ...(session.staffIdsJoined ?? [])]),
    );

    // includeUnattributed mirrors close(): online orders (no staffId) count
    // toward non-cash buckets; cash stays staff-only.
    const agg = (channels: string[], includeUnattributed = false) =>
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('o.businessId = :businessId', { businessId: session.businessId })
        .andWhere('o.storeId = :storeId', { storeId: session.storeId })
        .andWhere(
          includeUnattributed
            ? '(o.staffId IN (:...staffIds) OR o.staffId IS NULL)'
            : 'o.staffId IN (:...staffIds)',
          { staffIds: sessionStaffIds },
        )
        .andWhere('o.paymentChannel IN (:...chs)', { chs: channels })
        .andWhere('o.paidAt >= :from', { from: session.openedAt })
        .andWhere('o.paidAt <= :to', { to: until })
        .getRawOne<{ total: string; count: string }>();

    const cash = await agg(['cash']);
    const pos = await agg(['card', 'paystack'], true);
    const mobile = await agg(['wallet', 'points'], true);
    const cashAmount = Number(cash?.total ?? 0);
    const cashCount = Number(cash?.count ?? 0);
    const posAmount = Number(pos?.total ?? 0);
    const posCount = Number(pos?.count ?? 0);
    const mobileAmount = Number(mobile?.total ?? 0);
    const mobileCount = Number(mobile?.count ?? 0);
    const grandTotal = cashAmount + posAmount + mobileAmount;
    const orderCount = cashCount + posCount + mobileCount;

    const fmtDate = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0');
      let h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ampm}`;
    };
    const money = (n: number) => n.toFixed(2);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('REGISTER REPORT', { align: 'left' });
      doc.moveDown(1);

      const line = (label: string, value: string) => {
        doc.fontSize(10).text(`${label}`, { continued: true });
        doc.text(`   ${value}`, { align: 'right' });
      };
      line('Store', storeName);
      line('Billing Counter', session.counterName ?? '-');
      line('Total Closing Amount (NGN)', money(Number(session.actualTotal)));
      line('Total Order Count', String(orderCount));
      doc.moveDown(0.5);
      line('Opened By', session.staffName);
      line('Staffs Joined In', (session.staffsJoined ?? [session.staffName]).join(', '));
      line('Opened On', fmtDate(new Date(session.openedAt)));
      line('Closed On', session.closedAt ? fmtDate(new Date(session.closedAt)) : '-');
      line('Updated On', fmtDate(new Date(session.updatedAt)));
      doc.moveDown(1);

      doc.fontSize(11).text('Amount (NGN)                                Count');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      const row = (label: string, amount: string, count: string) => {
        doc.fontSize(10).text(label, 50, doc.y, { continued: true });
        doc.text(`${amount}        ${count}`, { align: 'right' });
      };
      row('Opening Amount', money(Number(session.openingFloat)), '-');
      row('Closing Amount', money(Number(session.actualTotal)), '-');
      row('Credit Card Slips', '-', '0');
      row('Cheques', '-', '0');
      row('Cash', money(cashAmount), String(cashCount));
      row('Pos', money(posAmount), String(posCount));
      row('Online / Wallet', money(mobileAmount), String(mobileCount));
      row('Order Grand Total', money(grandTotal), String(orderCount));
      doc.moveDown(2);
      doc.fontSize(10).text('Thank You!', { align: 'center' });

      doc.end();
    });

    return {
      buffer,
      filename: `register-${session.counterName ?? session.id}.pdf`,
    };
  }

  async getStats(
    actor: ActorContext,
    filter: CashSessionFilterDto,
  ): Promise<CashSessionStatsDto> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.businessId = :businessId', { businessId: actor.businessId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('s.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.storeId) qb.andWhere('s.storeId = :storeId', { storeId: filter.storeId });
    if (filter.dateFrom) qb.andWhere('s.openedAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo)
      qb.andWhere('s.openedAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [openCount, closedCount, reviewedCount, balancedCount, shortCount, overCount] =
      await Promise.all([
        qb.clone().andWhere('s.status = :st', { st: 'open' }).getCount(),
        qb.clone().andWhere('s.status = :st', { st: 'closed' }).getCount(),
        qb.clone().andWhere('s.status = :st', { st: 'reviewed' }).getCount(),
        qb.clone().andWhere('s.reconciliationStatus = :rs', { rs: 'balanced' }).getCount(),
        qb.clone().andWhere('s.reconciliationStatus = :rs', { rs: 'short' }).getCount(),
        qb.clone().andWhere('s.reconciliationStatus = :rs', { rs: 'over' }).getCount(),
      ]);

    const shortRow = await qb
      .clone()
      .select('COALESCE(SUM(s.difference), 0)', 'total')
      .andWhere('s.reconciliationStatus = :rs', { rs: 'short' })
      .getRawOne<{ total: string }>();
    const overRow = await qb
      .clone()
      .select('COALESCE(SUM(s.difference), 0)', 'total')
      .andWhere('s.reconciliationStatus = :rs', { rs: 'over' })
      .getRawOne<{ total: string }>();

    return {
      openCount,
      closedCount,
      reviewedCount,
      balancedCount,
      shortCount,
      overCount,
      totalShortAmount: Math.abs(Number(shortRow?.total ?? 0)),
      totalOverAmount: Number(overRow?.total ?? 0),
    };
  }
}
