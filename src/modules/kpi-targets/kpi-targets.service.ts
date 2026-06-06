import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KpiAssignmentType,
  KpiCategory,
  KpiPeriod,
  KpiStatus,
  KpiTargetEntity,
} from './entities/kpi-target.entity';
import { KpiPerformanceEntity } from './entities/kpi-performance.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import {
  CreateKpiTargetDto,
  KpiPerformanceRowDto,
  KpiTargetFilterDto,
  KpiTargetResponseDto,
  RecordKpiPerformanceDto,
  UpdateKpiTargetDto,
} from './dto/kpi-target.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  roleId?: string;
}

@Injectable()
export class KpiTargetsService {
  constructor(
    @InjectRepository(KpiTargetEntity)
    private readonly repo: Repository<KpiTargetEntity>,
    @InjectRepository(KpiPerformanceEntity)
    private readonly perfRepo: Repository<KpiPerformanceEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async list(
    actor: ActorContext,
    filter: KpiTargetFilterDto,
  ): Promise<PaginatedResponseDto<KpiTargetResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('k')
      .where('k.businessId = :businessId', { businessId: actor.businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('k.createdAt', 'DESC');
    if (filter.storeId) qb.andWhere('k.storeId = :storeId', { storeId: filter.storeId });
    if (filter.category) qb.andWhere('k.category = :cat', { cat: filter.category });
    if (filter.assignmentType)
      qb.andWhere('k.assignmentType = :at', { at: filter.assignmentType });
    if (filter.period) qb.andWhere('k.period = :pd', { pd: filter.period });
    if (filter.status) qb.andWhere('k.status = :st', { st: filter.status });
    if (filter.search)
      qb.andWhere('(k.name ILIKE :s OR k.description ILIKE :s)', {
        s: `%${filter.search}%`,
      });

    // Staff JWTs see only KPIs they're targeted by.
    if (actor.sub_type === 'staff') {
      qb.andWhere('k.storeId = :scopedStore', { scopedStore: actor.storeId });
      qb.andWhere(
        '(k.assignmentType = :allStaff ' +
          'OR (k.assignmentType = :staff AND k.assignedToId = :sid) ' +
          'OR (k.assignmentType = :role AND k.assignedToId = :rid))',
        {
          allStaff: KpiAssignmentType.ALL_STAFF,
          staff: KpiAssignmentType.STAFF,
          role: KpiAssignmentType.ROLE,
          sid: actor.sub,
          rid: actor.roleId ?? null,
        },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    // Refresh currentValue/status from live performances before responding.
    const refreshed = await Promise.all(
      data.map((t) => this.refreshAggregate(t)),
    );
    return paginate(refreshed, total, page, limit, KpiTargetResponseDto.from);
  }

  async findOne(
    actor: ActorContext,
    id: string,
  ): Promise<KpiTargetResponseDto> {
    const target = await this.findEntity(actor.businessId, id);
    const fresh = await this.refreshAggregate(target);
    return KpiTargetResponseDto.from(fresh);
  }

  async create(
    actor: ActorContext,
    dto: CreateKpiTargetDto,
  ): Promise<KpiTargetResponseDto> {
    const { assignedToId, assignedToName } = await this.resolveAssignment(
      dto.assignmentType,
      dto.assignedToId,
      dto.assignedToName,
    );
    const target = this.repo.create({
      businessId: actor.businessId,
      storeId: dto.storeId,
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category,
      assignmentType: dto.assignmentType,
      assignedToId,
      assignedToName,
      period: dto.period,
      targetValue: dto.targetValue,
      currentValue: 0,
      unit: dto.unit ?? '',
      periodStart: dto.periodStart ?? null,
      periodEnd: dto.periodEnd ?? null,
      status: KpiStatus.ON_TRACK,
    });
    const saved = await this.repo.save(target);
    return KpiTargetResponseDto.from(saved);
  }

  async update(
    actor: ActorContext,
    id: string,
    dto: UpdateKpiTargetDto,
  ): Promise<KpiTargetResponseDto> {
    const target = await this.findEntity(actor.businessId, id);

    if (
      dto.assignmentType !== undefined ||
      dto.assignedToId !== undefined ||
      dto.assignedToName !== undefined
    ) {
      const { assignedToId, assignedToName } = await this.resolveAssignment(
        dto.assignmentType ?? target.assignmentType,
        dto.assignedToId ?? target.assignedToId ?? undefined,
        dto.assignedToName ?? target.assignedToName ?? undefined,
      );
      target.assignmentType = dto.assignmentType ?? target.assignmentType;
      target.assignedToId = assignedToId;
      target.assignedToName = assignedToName;
    }

    if (dto.name !== undefined) target.name = dto.name;
    if (dto.description !== undefined)
      target.description = dto.description ?? null;
    if (dto.storeId !== undefined) target.storeId = dto.storeId;
    if (dto.category !== undefined) target.category = dto.category;
    if (dto.period !== undefined) target.period = dto.period;
    if (dto.targetValue !== undefined) target.targetValue = dto.targetValue;
    if (dto.unit !== undefined) target.unit = dto.unit;
    if (dto.periodStart !== undefined)
      target.periodStart = dto.periodStart ?? null;
    if (dto.periodEnd !== undefined) target.periodEnd = dto.periodEnd ?? null;

    const saved = await this.repo.save(target);
    const fresh = await this.refreshAggregate(saved);
    return KpiTargetResponseDto.from(fresh);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const target = await this.findEntity(actor.businessId, id);
    await this.repo.softRemove(target);
  }

  /** Manually record a per-staff performance value (upsert). Used for
   *  categories that aren't auto-computed from orders. */
  async recordPerformance(
    actor: ActorContext,
    targetId: string,
    dto: RecordKpiPerformanceDto,
  ): Promise<KpiPerformanceRowDto[]> {
    const target = await this.findEntity(actor.businessId, targetId);
    const staff = await this.staffRepo.findOne({ where: { id: dto.staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const existing = await this.perfRepo.findOne({
      where: { kpiTargetId: target.id, staffId: dto.staffId },
    });
    if (existing) {
      existing.value = dto.value;
      existing.staffName = `${staff.firstName} ${staff.lastName}`.trim();
      existing.note = dto.note ?? existing.note;
      await this.perfRepo.save(existing);
    } else {
      await this.perfRepo.save(
        this.perfRepo.create({
          kpiTargetId: target.id,
          staffId: dto.staffId,
          staffName: `${staff.firstName} ${staff.lastName}`.trim(),
          value: dto.value,
          note: dto.note ?? null,
        }),
      );
    }

    await this.refreshAggregate(target);
    return this.listPerformances(actor, targetId);
  }

  /** Returns the per-staff progress rows used by the merchant-hub
   *  Performances tab. */
  async listPerformances(
    actor: ActorContext,
    targetId: string,
  ): Promise<KpiPerformanceRowDto[]> {
    const target = await this.findEntity(actor.businessId, targetId);
    const contributors = await this.resolveContributors(target);
    if (contributors.length === 0) return [];

    const target_ = Number(target.targetValue);
    const share = target_ / contributors.length;

    // Compute values: live from orders for sales/orders categories, else
    // read manual entries from KpiPerformanceEntity.
    let valueByStaff: Map<string, number>;
    let source: 'computed' | 'manual';
    if (target.category === KpiCategory.SALES) {
      valueByStaff = await this.computeSalesByStaff(target);
      source = 'computed';
    } else if (target.category === KpiCategory.ORDERS) {
      valueByStaff = await this.computeOrderCountByStaff(target);
      source = 'computed';
    } else {
      const rows = await this.perfRepo.find({
        where: { kpiTargetId: target.id },
      });
      valueByStaff = new Map(rows.map((r) => [r.staffId, Number(r.value)]));
      source = 'manual';
    }

    return contributors.map((c) => {
      const value = valueByStaff.get(c.id) ?? 0;
      return {
        staffId: c.id,
        staffName: c.name,
        roleName: c.roleName,
        value,
        share: Math.round(share * 100) / 100,
        progress: share > 0 ? Math.round((value / share) * 100) : 0,
        source,
      };
    });
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<KpiTargetEntity> {
    const t = await this.repo.findOne({ where: { id, businessId } });
    if (!t) throw new NotFoundException('KPI target not found');
    return t;
  }

  private async resolveAssignment(
    assignmentType: KpiAssignmentType,
    assignedToId: string | undefined,
    assignedToName: string | undefined,
  ): Promise<{ assignedToId: string | null; assignedToName: string }> {
    if (assignmentType === KpiAssignmentType.ALL_STAFF) {
      return { assignedToId: null, assignedToName: assignedToName ?? 'All Staff' };
    }
    if (!assignedToId) {
      throw new BadRequestException(
        `assignedToId is required when assignmentType=${assignmentType}`,
      );
    }
    if (assignmentType === KpiAssignmentType.ROLE) {
      const role = await this.roleRepo.findOne({ where: { id: assignedToId } });
      if (!role) throw new NotFoundException('Role not found');
      return { assignedToId, assignedToName: assignedToName ?? role.name };
    }
    // STAFF
    const staff = await this.staffRepo.findOne({ where: { id: assignedToId } });
    if (!staff) throw new NotFoundException('Staff not found');
    return {
      assignedToId,
      assignedToName:
        assignedToName ?? `${staff.firstName} ${staff.lastName}`.trim(),
    };
  }

  /** Returns the set of staff who could contribute to this target. */
  private async resolveContributors(
    target: KpiTargetEntity,
  ): Promise<Array<{ id: string; name: string; roleName: string | null }>> {
    if (target.assignmentType === KpiAssignmentType.STAFF) {
      if (!target.assignedToId) return [];
      const s = await this.staffRepo.findOne({
        where: { id: target.assignedToId },
        relations: ['role'],
      });
      if (!s) return [];
      return [
        {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          roleName: s.role?.name ?? null,
        },
      ];
    }

    const qb = this.staffRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.role', 'role')
      .where('s.storeId = :storeId', { storeId: target.storeId });

    if (target.assignmentType === KpiAssignmentType.ROLE) {
      qb.andWhere('s.roleId = :roleId', { roleId: target.assignedToId });
    }

    const staff = await qb.getMany();
    return staff.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      roleName: s.role?.name ?? null,
    }));
  }

  /** Aggregates per-staff order subtotals for the target's period. */
  private async computeSalesByStaff(
    target: KpiTargetEntity,
  ): Promise<Map<string, number>> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.staffId', 'staffId')
      .addSelect('SUM(o.subtotal)', 'total')
      .where('o.businessId = :businessId', { businessId: target.businessId })
      .andWhere('o.storeId = :storeId', { storeId: target.storeId })
      .andWhere('o.staffId IS NOT NULL')
      .andWhere('o.status = :status', { status: OrderStatus.COMPLETED });
    this.scopeOrdersToPeriod(qb, target);
    const rows = await qb.groupBy('o.staffId').getRawMany<{
      staffId: string;
      total: string;
    }>();
    return new Map(rows.map((r) => [r.staffId, Number(r.total)]));
  }

  /** Aggregates completed-order count per staff for the target's period. */
  private async computeOrderCountByStaff(
    target: KpiTargetEntity,
  ): Promise<Map<string, number>> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.staffId', 'staffId')
      .addSelect('COUNT(o.id)', 'count')
      .where('o.businessId = :businessId', { businessId: target.businessId })
      .andWhere('o.storeId = :storeId', { storeId: target.storeId })
      .andWhere('o.staffId IS NOT NULL')
      .andWhere('o.status = :status', { status: OrderStatus.COMPLETED });
    this.scopeOrdersToPeriod(qb, target);
    const rows = await qb.groupBy('o.staffId').getRawMany<{
      staffId: string;
      count: string;
    }>();
    return new Map(rows.map((r) => [r.staffId, Number(r.count)]));
  }

  private scopeOrdersToPeriod(
    qb: import('typeorm').SelectQueryBuilder<OrderEntity>,
    target: KpiTargetEntity,
  ): void {
    const { start, end } = this.activePeriodWindow(target);
    if (start) qb.andWhere('o.createdAt >= :start', { start });
    if (end) qb.andWhere('o.createdAt < :end', { end });
  }

  /** Calendar window the KPI is measured over right now. For recurring
   *  periods this is the current calendar bucket (e.g., the current month for
   *  MONTHLY). For ONE_OFF, it's the explicit periodStart/periodEnd. */
  private activePeriodWindow(target: KpiTargetEntity): {
    start: Date | null;
    end: Date | null;
  } {
    const now = new Date();
    const explicit = target.periodStart || target.periodEnd;
    if (target.period === KpiPeriod.ONE_OFF || explicit) {
      return {
        start: target.periodStart ? new Date(target.periodStart) : null,
        end: target.periodEnd
          ? new Date(`${target.periodEnd}T23:59:59.999Z`)
          : null,
      };
    }
    switch (target.period) {
      case KpiPeriod.DAILY: {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start, end };
      }
      case KpiPeriod.WEEKLY: {
        const day = now.getDay();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return { start, end };
      }
      case KpiPeriod.MONTHLY: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start, end };
      }
      case KpiPeriod.QUARTERLY: {
        const q = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), q, 1);
        const end = new Date(now.getFullYear(), q + 3, 1);
        return { start, end };
      }
      case KpiPeriod.YEARLY: {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear() + 1, 0, 1);
        return { start, end };
      }
      default:
        return { start: null, end: null };
    }
  }

  /** Recomputes currentValue + status based on either live orders or the
   *  sum of manual performance rows. Saves and returns the updated row. */
  private async refreshAggregate(
    target: KpiTargetEntity,
  ): Promise<KpiTargetEntity> {
    let current = 0;
    if (target.category === KpiCategory.SALES) {
      const valueByStaff = await this.computeSalesByStaff(target);
      for (const v of valueByStaff.values()) current += v;
    } else if (target.category === KpiCategory.ORDERS) {
      const valueByStaff = await this.computeOrderCountByStaff(target);
      for (const v of valueByStaff.values()) current += v;
    } else {
      const sumRow = await this.perfRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.value), 0)', 'sum')
        .where('p.kpiTargetId = :id', { id: target.id })
        .getRawOne<{ sum: string }>();
      current = Number(sumRow?.sum ?? 0);
    }

    const targetVal = Number(target.targetValue);
    const ratio = targetVal > 0 ? current / targetVal : 0;
    target.currentValue = current;
    target.status =
      ratio >= 1.2
        ? KpiStatus.EXCEEDED
        : ratio >= 1
          ? KpiStatus.ACHIEVED
          : ratio >= 0.85
            ? KpiStatus.ON_TRACK
            : ratio >= 0.6
              ? KpiStatus.AT_RISK
              : KpiStatus.BEHIND;

    // Only persist if it actually changed (avoid touching updatedAt every read).
    return this.repo.save(target);
  }
}
