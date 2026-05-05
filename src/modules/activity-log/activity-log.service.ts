import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity, ActorType } from './entities/activity-log.entity';
import { ActivityLogResponseDto } from './dto/activity-log-response.dto';
import { ActivityLogFilterDto } from './dto/activity-log-filter.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

export interface RecordActivityInput {
  actorType: ActorType;
  actorId: string | null;
  actorName: string;
  action: string;
  businessId: string;
  storeId?: string | null;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly repo: Repository<ActivityLogEntity>,
  ) {}

  /**
   * Append-only audit emit. Fire-and-forget — never blocks the calling
   * request and never throws. Failures are logged so the underlying
   * operation always succeeds even if audit writes fail.
   */
  record(input: RecordActivityInput): void {
    void this.repo
      .save(
        this.repo.create({
          actorType: input.actorType,
          actorId: input.actorId,
          actorName: input.actorName,
          action: input.action,
          businessId: input.businessId,
          storeId: input.storeId ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          metadata: input.metadata ?? null,
        }),
      )
      .catch((err: Error) =>
        this.logger.error(`Activity log write failed: ${err.message}`, err.stack),
      );
  }

  async findAll(
    businessId: string,
    filter: ActivityLogFilterDto,
    scope?: { storeId?: string; actorId?: string },
  ): Promise<PaginatedResponseDto<ActivityLogResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.businessId = :businessId', { businessId })
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.resourceType) qb.andWhere('a.resourceType = :rt', { rt: filter.resourceType });
    if (filter.resourceId) qb.andWhere('a.resourceId = :rid', { rid: filter.resourceId });
    if (filter.actorId) qb.andWhere('a.actorId = :aid', { aid: filter.actorId });
    if (filter.actorType) qb.andWhere('a.actorType = :at', { at: filter.actorType });
    if (filter.storeId) qb.andWhere('a.storeId = :sid', { sid: filter.storeId });

    if (filter.action) {
      if (filter.action.endsWith('.*')) {
        const prefix = filter.action.slice(0, -2);
        qb.andWhere('a.action LIKE :ap', { ap: `${prefix}.%` });
      } else {
        qb.andWhere('a.action = :a', { a: filter.action });
      }
    }

    if (filter.dateFrom) qb.andWhere('a.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('a.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    // Staff scoping: visible if entry targets their store OR was authored by them.
    if (scope?.storeId && scope?.actorId) {
      qb.andWhere('(a.storeId = :scopedStore OR a.actorId = :scopedActor)', {
        scopedStore: scope.storeId,
        scopedActor: scope.actorId,
      });
    } else if (scope?.storeId) {
      qb.andWhere('a.storeId = :scopedStore', { scopedStore: scope.storeId });
    } else if (scope?.actorId) {
      qb.andWhere('a.actorId = :scopedActor', { scopedActor: scope.actorId });
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, ActivityLogResponseDto.from);
  }
}
