import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity, EventStatus } from './entities/event.entity';
import {
  CreateEventDto,
  EventFilterDto,
  RecordPaymentDto,
  UpdateEventDto,
} from './dto/event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';

const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.INQUIRY]: [EventStatus.PENDING, EventStatus.CANCELLED],
  [EventStatus.PENDING]: [EventStatus.CONFIRMED, EventStatus.CANCELLED],
  [EventStatus.CONFIRMED]: [
    EventStatus.IN_PROGRESS,
    EventStatus.CANCELLED,
  ],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(
    businessId: string,
    filter: EventFilterDto,
  ): Promise<PaginatedResponseDto<EventResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.startTime', 'ASC');

    if (filter.storeId) qb.andWhere('e.storeId = :storeId', { storeId: filter.storeId });
    if (filter.status) qb.andWhere('e.status = :s', { s: filter.status });
    if (filter.type) qb.andWhere('e.type = :t', { t: filter.type });
    if (filter.dateFrom) qb.andWhere('e.date >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('e.date <= :dt', { dt: filter.dateTo });
    if (filter.search) {
      qb.andWhere(
        '(e.name ILIKE :q OR e.contactName ILIKE :q OR e.contactEmail ILIKE :q OR e.contactPhone ILIKE :q OR e.venueArea ILIKE :q)',
        { q: `%${filter.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, EventResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<EventResponseDto> {
    return EventResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<EventEntity> {
    const e = await this.repo.findOne({ where: { id, businessId } });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  async create(
    actor: AdminJwtPayload,
    dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    const e = this.repo.create({
      ...dto,
      businessId: actor.businessId,
      customerId: dto.customerId ?? null,
      description: dto.description ?? null,
      contactEmail: dto.contactEmail ?? null,
      venueArea: dto.venueArea ?? null,
      deposit: dto.deposit ?? null,
      totalAmount: dto.totalAmount ?? null,
      notes: dto.notes ?? null,
      status: EventStatus.INQUIRY,
      depositPaid: false,
      paidAmount: 0,
    });
    const saved = await this.repo.save(e);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'event.created',
      businessId: actor.businessId,
      storeId: dto.storeId,
      resourceType: 'event',
      resourceId: saved.id,
      metadata: { name: saved.name, type: saved.type, date: saved.date },
    });

    return EventResponseDto.from(saved);
  }

  async update(
    actor: AdminJwtPayload,
    id: string,
    dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    const e = await this.findEntity(actor.businessId, id);
    if (dto.status && dto.status !== e.status) {
      this.assertTransition(e.status, dto.status);
    }
    Object.assign(e, dto);
    const saved = await this.repo.save(e);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'event.updated',
      businessId: actor.businessId,
      storeId: e.storeId,
      resourceType: 'event',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return EventResponseDto.from(saved);
  }

  async confirm(actor: AdminJwtPayload, id: string): Promise<EventResponseDto> {
    return this.transition(actor, id, EventStatus.CONFIRMED, 'confirmed');
  }
  async start(actor: AdminJwtPayload, id: string): Promise<EventResponseDto> {
    return this.transition(actor, id, EventStatus.IN_PROGRESS, 'started');
  }
  async complete(actor: AdminJwtPayload, id: string): Promise<EventResponseDto> {
    return this.transition(actor, id, EventStatus.COMPLETED, 'completed');
  }
  async cancel(actor: AdminJwtPayload, id: string): Promise<EventResponseDto> {
    return this.transition(actor, id, EventStatus.CANCELLED, 'cancelled');
  }

  async recordPayment(
    actor: AdminJwtPayload,
    id: string,
    dto: RecordPaymentDto,
  ): Promise<EventResponseDto> {
    const e = await this.findEntity(actor.businessId, id);
    e.paidAmount = Number(e.paidAmount) + dto.amount;
    if (dto.asDeposit) e.depositPaid = true;
    if (e.deposit && Number(e.paidAmount) >= Number(e.deposit)) {
      e.depositPaid = true;
    }
    const saved = await this.repo.save(e);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'event.payment_recorded',
      businessId: actor.businessId,
      storeId: e.storeId,
      resourceType: 'event',
      resourceId: id,
      metadata: { amount: dto.amount, paidAmount: Number(saved.paidAmount) },
    });

    return EventResponseDto.from(saved);
  }

  async remove(actor: AdminJwtPayload, id: string): Promise<void> {
    const e = await this.findEntity(actor.businessId, id);
    await this.repo.softRemove(e);
    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'event.deleted',
      businessId: actor.businessId,
      storeId: e.storeId,
      resourceType: 'event',
      resourceId: id,
    });
  }

  private async transition(
    actor: AdminJwtPayload,
    id: string,
    next: EventStatus,
    actionSuffix: string,
  ): Promise<EventResponseDto> {
    const e = await this.findEntity(actor.businessId, id);
    this.assertTransition(e.status, next);
    e.status = next;
    const saved = await this.repo.save(e);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: `event.${actionSuffix}`,
      businessId: actor.businessId,
      storeId: e.storeId,
      resourceType: 'event',
      resourceId: id,
    });

    return EventResponseDto.from(saved);
  }

  private assertTransition(from: EventStatus, to: EventStatus): void {
    if (from === to) return;
    if (!VALID_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
    }
  }

  // ---------- Stats ----------

  async getStats(businessId: string, storeId?: string) {
    const today = new Date().toISOString().slice(0, 10);

    const baseQb = () => {
      const qb = this.repo
        .createQueryBuilder('e')
        .where('e.businessId = :businessId', { businessId });
      if (storeId) qb.andWhere('e.storeId = :storeId', { storeId });
      return qb;
    };

    const totalEvents = await baseQb().getCount();
    const upcomingEvents = await baseQb()
      .andWhere('e.date >= :today', { today })
      .andWhere('e.status IN (:...alive)', {
        alive: [
          EventStatus.INQUIRY,
          EventStatus.PENDING,
          EventStatus.CONFIRMED,
        ],
      })
      .getCount();
    const inProgressEvents = await baseQb()
      .andWhere('e.status = :s', { s: EventStatus.IN_PROGRESS })
      .getCount();

    const expectedRevenueRow = await baseQb()
      .andWhere('e.status IN (:...alive)', {
        alive: [
          EventStatus.PENDING,
          EventStatus.CONFIRMED,
          EventStatus.IN_PROGRESS,
        ],
      })
      .select('COALESCE(SUM(e.totalAmount), 0)', 'sum')
      .getRawOne<{ sum: string }>();

    const collectedRow = await baseQb()
      .select('COALESCE(SUM(e.paidAmount), 0)', 'sum')
      .getRawOne<{ sum: string }>();

    return {
      totalEvents,
      upcomingEvents,
      inProgressEvents,
      expectedRevenue: Number(expectedRevenueRow?.sum ?? 0),
      collectedRevenue: Number(collectedRow?.sum ?? 0),
    };
  }

  async findForRange(
    businessId: string,
    storeId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<EventEntity[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.businessId = :businessId', { businessId })
      .andWhere('e.date >= :df', { df: dateFrom })
      .andWhere('e.date <= :dt', { dt: dateTo })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.startTime', 'ASC');
    if (storeId) qb.andWhere('e.storeId = :storeId', { storeId });
    return qb.getMany();
  }
}
