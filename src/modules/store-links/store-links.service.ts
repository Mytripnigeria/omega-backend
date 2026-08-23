import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  StoreLinkEntity,
  StoreLinkStatus,
} from './entities/store-link.entity';
import { StoreEntity } from '../store/entities/store.entity';
import {
  RequestStoreLinkDto,
  RespondStoreLinkDto,
  StoreLinkResponseDto,
} from './dto/store-link.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class StoreLinksService {
  constructor(
    @InjectRepository(StoreLinkEntity)
    private readonly repo: Repository<StoreLinkEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Store ids a workstation signed in at `storeId` may also work orders for.
   * Always includes the store itself, so callers can use it as the whole
   * visible set. Only APPROVED links count.
   */
  async accessibleStoreIds(storeId: string): Promise<string[]> {
    const links = await this.repo.find({
      where: { requesterStoreId: storeId, status: StoreLinkStatus.APPROVED },
    });
    return [storeId, ...links.map((l) => l.targetStoreId)];
  }

  private async nameMap(ids: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const stores = await this.storeRepo.find({
      where: { id: In(unique) },
      select: { id: true, name: true },
    });
    return new Map(stores.map((s) => [s.id, s.name]));
  }

  private async present(rows: StoreLinkEntity[]) {
    const names = await this.nameMap(
      rows.flatMap((r) => [r.requesterStoreId, r.targetStoreId]),
    );
    return rows.map((r) =>
      StoreLinkResponseDto.from(r, {
        requester: names.get(r.requesterStoreId) ?? null,
        target: names.get(r.targetStoreId) ?? null,
      }),
    );
  }

  /** Links this workstation's store has asked for (any status). */
  async listOutgoing(storeId: string) {
    const rows = await this.repo.find({
      where: { requesterStoreId: storeId },
      order: { createdAt: 'DESC' },
    });
    return this.present(rows);
  }

  /** Requests other stores have made against this business's stores. */
  async listIncoming(businessId: string) {
    const rows = await this.repo.find({
      where: { targetBusinessId: businessId },
      order: { createdAt: 'DESC' },
    });
    return this.present(rows);
  }

  async request(
    requesterBusinessId: string,
    requesterStoreId: string,
    dto: RequestStoreLinkDto,
    requestedByStaffId?: string,
  ) {
    if (dto.targetStoreId === requesterStoreId) {
      throw new BadRequestException('A store cannot link to itself');
    }
    const target = await this.storeRepo.findOne({
      where: { id: dto.targetStoreId },
    });
    if (!target) throw new NotFoundException('No store with that id');

    const existing = await this.repo.findOne({
      where: { requesterStoreId, targetStoreId: dto.targetStoreId },
    });
    if (existing) {
      if (existing.status === StoreLinkStatus.PENDING) {
        throw new ConflictException('A request to this store is already awaiting approval');
      }
      if (existing.status === StoreLinkStatus.APPROVED) {
        throw new ConflictException('This store is already linked');
      }
      // A previously declined or revoked link may be asked for again.
      existing.status = StoreLinkStatus.PENDING;
      existing.message = dto.message ?? null;
      existing.requestedByStaffId = requestedByStaffId ?? null;
      existing.respondedAt = null;
      const saved = await this.repo.save(existing);
      return (await this.present([saved]))[0];
    }

    const saved = await this.repo.save(
      this.repo.create({
        requesterStoreId,
        requesterBusinessId,
        targetStoreId: target.id,
        targetBusinessId: target.businessId,
        status: StoreLinkStatus.PENDING,
        message: dto.message ?? null,
        requestedByStaffId: requestedByStaffId ?? null,
      }),
    );

    this.activityLog.record({
      actorType: 'staff',
      actorId: requestedByStaffId ?? saved.id,
      actorName: 'Workstation',
      action: 'store_link.requested',
      businessId: requesterBusinessId,
      storeId: requesterStoreId,
      resourceType: 'store_link',
      resourceId: saved.id,
      metadata: { targetStoreId: target.id },
    });

    return (await this.present([saved]))[0];
  }

  /** The target business approves or declines. */
  async respond(
    businessId: string,
    id: string,
    dto: RespondStoreLinkDto,
    actorId: string,
    actorName: string,
  ) {
    const link = await this.repo.findOne({ where: { id } });
    if (!link || link.targetBusinessId !== businessId) {
      throw new NotFoundException('Link request not found');
    }
    if (link.status !== StoreLinkStatus.PENDING) {
      throw new BadRequestException('This request has already been answered');
    }
    link.status = dto.status;
    link.respondedAt = new Date();
    const saved = await this.repo.save(link);

    this.activityLog.record({
      actorType: 'admin',
      actorId,
      actorName,
      action: `store_link.${dto.status}`,
      businessId,
      storeId: link.targetStoreId,
      resourceType: 'store_link',
      resourceId: saved.id,
      metadata: { requesterStoreId: link.requesterStoreId },
    });

    return (await this.present([saved]))[0];
  }

  /**
   * Ends a link. Either side may do this: the requester is giving up access,
   * the target is withdrawing it.
   */
  async revoke(opts: {
    id: string;
    businessId: string;
    storeId?: string;
  }): Promise<void> {
    const link = await this.repo.findOne({ where: { id: opts.id } });
    if (!link) throw new NotFoundException('Link not found');
    const isTarget = link.targetBusinessId === opts.businessId;
    const isRequester =
      link.requesterBusinessId === opts.businessId &&
      (!opts.storeId || link.requesterStoreId === opts.storeId);
    if (!isTarget && !isRequester) {
      throw new NotFoundException('Link not found');
    }
    link.status = StoreLinkStatus.REVOKED;
    link.respondedAt = new Date();
    await this.repo.save(link);
  }
}
