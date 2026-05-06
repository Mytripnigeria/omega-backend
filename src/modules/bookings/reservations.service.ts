import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReservationEntity,
  ReservationStatus,
} from './entities/reservation.entity';
import {
  CancelReservationDto,
  CreateReservationDto,
  ReservationFilterDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';

const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.SEATED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.SEATED]: [ReservationStatus.COMPLETED],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly repo: Repository<ReservationEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(
    businessId: string,
    filter: ReservationFilterDto,
  ): Promise<PaginatedResponseDto<ReservationResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.date', 'DESC')
      .addOrderBy('r.time', 'ASC');

    if (filter.storeId)
      qb.andWhere('r.storeId = :storeId', { storeId: filter.storeId });
    if (filter.status) qb.andWhere('r.status = :s', { s: filter.status });
    if (filter.customerId)
      qb.andWhere('r.customerId = :cid', { cid: filter.customerId });
    if (filter.date) qb.andWhere('r.date = :d', { d: filter.date });
    if (filter.dateFrom) qb.andWhere('r.date >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('r.date <= :dt', { dt: filter.dateTo });
    if (filter.search) {
      qb.andWhere(
        '(r.customerName ILIKE :q OR r.customerPhone ILIKE :q OR r.customerEmail ILIKE :q OR r.tableNumber ILIKE :q)',
        { q: `%${filter.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, ReservationResponseDto.from);
  }

  async findOne(
    businessId: string,
    id: string,
  ): Promise<ReservationResponseDto> {
    return ReservationResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<ReservationEntity> {
    const r = await this.repo.findOne({ where: { id, businessId } });
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async create(
    actor: AdminJwtPayload,
    dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const r = this.repo.create({
      ...dto,
      businessId: actor.businessId,
      customerId: dto.customerId ?? null,
      customerEmail: dto.customerEmail ?? null,
      duration: dto.duration ?? null,
      tableNumber: dto.tableNumber ?? null,
      notes: dto.notes ?? null,
      specialRequests: dto.specialRequests ?? null,
      status: ReservationStatus.PENDING,
    });
    const saved = await this.repo.save(r);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'reservation.created',
      businessId: actor.businessId,
      storeId: dto.storeId,
      resourceType: 'reservation',
      resourceId: saved.id,
      metadata: {
        customerName: saved.customerName,
        date: saved.date,
        time: saved.time,
      },
    });

    return ReservationResponseDto.from(saved);
  }

  async update(
    actor: AdminJwtPayload,
    id: string,
    dto: UpdateReservationDto,
  ): Promise<ReservationResponseDto> {
    const r = await this.findEntity(actor.businessId, id);
    if (dto.status && dto.status !== r.status) {
      this.assertTransition(r.status, dto.status);
      this.applyTimestamps(r, dto.status);
    }
    Object.assign(r, dto);
    const saved = await this.repo.save(r);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'reservation.updated',
      businessId: actor.businessId,
      storeId: r.storeId,
      resourceType: 'reservation',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return ReservationResponseDto.from(saved);
  }

  async confirm(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<ReservationResponseDto> {
    return this.transition(actor, id, ReservationStatus.CONFIRMED, 'confirmed');
  }

  async seat(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<ReservationResponseDto> {
    return this.transition(actor, id, ReservationStatus.SEATED, 'seated');
  }

  async complete(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<ReservationResponseDto> {
    return this.transition(actor, id, ReservationStatus.COMPLETED, 'completed');
  }

  async noShow(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<ReservationResponseDto> {
    return this.transition(actor, id, ReservationStatus.NO_SHOW, 'no_show');
  }

  async cancel(
    actor: AdminJwtPayload,
    id: string,
    dto: CancelReservationDto,
  ): Promise<ReservationResponseDto> {
    const r = await this.findEntity(actor.businessId, id);
    this.assertTransition(r.status, ReservationStatus.CANCELLED);
    r.status = ReservationStatus.CANCELLED;
    r.cancelledAt = new Date();
    r.cancellationReason = dto.reason ?? null;
    const saved = await this.repo.save(r);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'reservation.cancelled',
      businessId: actor.businessId,
      storeId: r.storeId,
      resourceType: 'reservation',
      resourceId: id,
      metadata: { reason: dto.reason ?? null },
    });

    return ReservationResponseDto.from(saved);
  }

  async remove(actor: AdminJwtPayload, id: string): Promise<void> {
    const r = await this.findEntity(actor.businessId, id);
    await this.repo.softRemove(r);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'reservation.deleted',
      businessId: actor.businessId,
      storeId: r.storeId,
      resourceType: 'reservation',
      resourceId: id,
    });
  }

  private async transition(
    actor: AdminJwtPayload,
    id: string,
    next: ReservationStatus,
    actionSuffix: string,
  ): Promise<ReservationResponseDto> {
    const r = await this.findEntity(actor.businessId, id);
    this.assertTransition(r.status, next);
    r.status = next;
    this.applyTimestamps(r, next);
    const saved = await this.repo.save(r);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: `reservation.${actionSuffix}`,
      businessId: actor.businessId,
      storeId: r.storeId,
      resourceType: 'reservation',
      resourceId: id,
    });

    return ReservationResponseDto.from(saved);
  }

  private assertTransition(
    from: ReservationStatus,
    to: ReservationStatus,
  ): void {
    if (from === to) return;
    if (!VALID_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
    }
  }

  private applyTimestamps(r: ReservationEntity, status: ReservationStatus): void {
    if (status === ReservationStatus.SEATED) r.seatedAt = new Date();
    if (status === ReservationStatus.COMPLETED) r.completedAt = new Date();
    if (status === ReservationStatus.CANCELLED) r.cancelledAt = new Date();
  }

  // ---------- Stats ----------

  async getStats(businessId: string, storeId?: string) {
    const today = new Date().toISOString().slice(0, 10);

    const baseQb = () => {
      const qb = this.repo
        .createQueryBuilder('r')
        .where('r.businessId = :businessId', { businessId });
      if (storeId) qb.andWhere('r.storeId = :storeId', { storeId });
      return qb;
    };

    const totalReservations = await baseQb().getCount();
    const todayReservations = await baseQb()
      .andWhere('r.date = :today', { today })
      .getCount();
    const upcomingReservations = await baseQb()
      .andWhere('r.date >= :today', { today })
      .andWhere('r.status IN (:...alive)', {
        alive: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      })
      .getCount();
    const cancelledReservations = await baseQb()
      .andWhere('r.status = :s', { s: ReservationStatus.CANCELLED })
      .getCount();
    const noShowCount = await baseQb()
      .andWhere('r.status = :s', { s: ReservationStatus.NO_SHOW })
      .getCount();
    const completedCount = await baseQb()
      .andWhere('r.status = :s', { s: ReservationStatus.COMPLETED })
      .getCount();

    const denominator = completedCount + noShowCount;
    const noShowRate = denominator > 0 ? noShowCount / denominator : 0;

    return {
      totalReservations,
      todayReservations,
      upcomingReservations,
      cancelledReservations,
      noShowCount,
      noShowRate,
    };
  }

  /** Used by calendar feed in BookingsService */
  async findForRange(
    businessId: string,
    storeId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<ReservationEntity[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .andWhere('r.date >= :df', { df: dateFrom })
      .andWhere('r.date <= :dt', { dt: dateTo })
      .orderBy('r.date', 'ASC')
      .addOrderBy('r.time', 'ASC');
    if (storeId) qb.andWhere('r.storeId = :storeId', { storeId });
    return qb.getMany();
  }
}
