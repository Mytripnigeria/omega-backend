import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashSessionEntity } from './entities/cash-session.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
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
    const session = await this.repo.findOne({
      where: { staffId: actor.sub, status: 'open' },
      order: { openedAt: 'DESC' },
    });
    return session ? CashSessionResponseDto.from(session) : null;
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

    const cashRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('o.staffId = :staffId', { staffId: session.staffId })
      .andWhere('o.paymentChannel = :ch', { ch: 'cash' })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    const cardRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('o.staffId = :staffId', { staffId: session.staffId })
      .andWhere('o.paymentChannel IN (:...chs)', { chs: ['card', 'paystack'] })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    const mobileRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: session.businessId })
      .andWhere('o.storeId = :storeId', { storeId: session.storeId })
      .andWhere('o.staffId = :staffId', { staffId: session.staffId })
      .andWhere('o.paymentChannel IN (:...chs)', { chs: ['wallet', 'points'] })
      .andWhere('o.paidAt >= :openedAt', { openedAt: session.openedAt })
      .andWhere('o.paidAt <= :closedAt', { closedAt })
      .getRawOne<{ total: string }>();

    const expectedCash =
      Number(cashRow?.total ?? 0) + Number(session.openingFloat);
    const expectedCard = Number(cardRow?.total ?? 0);
    const expectedMobile = Number(mobileRow?.total ?? 0);
    const expectedTotal = expectedCash + expectedCard + expectedMobile;

    const actualCash = Number(dto.actualCash);
    const actualCard = Number(dto.actualCard);
    const actualMobile = Number(dto.actualMobile);
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
    if (filter.dateFrom) qb.andWhere('s.openedAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo)
      qb.andWhere('s.openedAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, CashSessionResponseDto.from);
  }

  async findOne(actor: ActorContext, id: string): Promise<CashSessionResponseDto> {
    return CashSessionResponseDto.from(await this.findEntity(actor, id));
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
    if (filter.dateFrom) qb.andWhere('s.openedAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo)
      qb.andWhere('s.openedAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

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
