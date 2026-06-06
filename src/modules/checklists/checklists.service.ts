import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  ChecklistAssignmentType,
  ChecklistEntity,
  ChecklistItem,
  ChecklistStatus,
} from './entities/checklist.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import {
  ChecklistFilterDto,
  ChecklistItemInputDto,
  ChecklistResponseDto,
  CreateChecklistDto,
  ToggleChecklistItemDto,
  UpdateChecklistDto,
} from './dto/checklist.dto';
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
  actorName?: string;
}

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(ChecklistEntity)
    private readonly repo: Repository<ChecklistEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async list(
    actor: ActorContext,
    filter: ChecklistFilterDto,
  ): Promise<PaginatedResponseDto<ChecklistResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId: actor.businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC');

    if (filter.storeId) qb.andWhere('c.storeId = :storeId', { storeId: filter.storeId });
    if (filter.assignmentType)
      qb.andWhere('c.assignmentType = :at', { at: filter.assignmentType });
    if (filter.frequency)
      qb.andWhere('c.frequency = :fq', { fq: filter.frequency });
    if (filter.status) qb.andWhere('c.status = :st', { st: filter.status });
    if (filter.search)
      qb.andWhere('(c.name ILIKE :s OR c.description ILIKE :s)', {
        s: `%${filter.search}%`,
      });

    // Staff-context narrowing: a staff caller should only see checklists
    // assigned to them personally, to their role, or to all staff in their
    // store. Admin callers see everything.
    if (actor.sub_type === 'staff') {
      const staffId = actor.sub;
      const roleId = actor.roleId ?? null;
      qb.andWhere('c.storeId = :scopedStore', {
        scopedStore: actor.storeId,
      }).andWhere(
        '(c.assignmentType = :allStaff ' +
          'OR (c.assignmentType = :staff AND c.assignedToId = :sid) ' +
          'OR (c.assignmentType = :role AND c.assignedToId = :rid))',
        {
          allStaff: ChecklistAssignmentType.ALL_STAFF,
          staff: ChecklistAssignmentType.STAFF,
          role: ChecklistAssignmentType.ROLE,
          sid: staffId,
          rid: roleId,
        },
      );
    } else if (filter.staffId) {
      // Admin asking for "what would this staff see" — same disjunction.
      const staff = await this.staffRepo.findOne({
        where: { id: filter.staffId },
      });
      if (staff) {
        qb.andWhere(
          '(c.assignmentType = :allStaff ' +
            'OR (c.assignmentType = :staff AND c.assignedToId = :sid) ' +
            'OR (c.assignmentType = :role AND c.assignedToId = :rid))',
          {
            allStaff: ChecklistAssignmentType.ALL_STAFF,
            staff: ChecklistAssignmentType.STAFF,
            role: ChecklistAssignmentType.ROLE,
            sid: filter.staffId,
            rid: staff.roleId ?? null,
          },
        );
      }
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, ChecklistResponseDto.from);
  }

  async findOne(
    actor: ActorContext,
    id: string,
  ): Promise<ChecklistResponseDto> {
    const checklist = await this.findEntity(actor.businessId, id);
    return ChecklistResponseDto.from(checklist);
  }

  async create(
    actor: ActorContext,
    dto: CreateChecklistDto,
  ): Promise<ChecklistResponseDto> {
    const { assignedToId, assignedToName } = await this.resolveAssignment(
      actor.businessId,
      dto.assignmentType,
      dto.assignedToId,
      dto.assignedToName,
    );

    const checklist = this.repo.create({
      businessId: actor.businessId,
      storeId: dto.storeId,
      name: dto.name,
      description: dto.description ?? null,
      assignmentType: dto.assignmentType,
      assignedToId,
      assignedToName,
      frequency: dto.frequency,
      dueTime: dto.dueTime ?? null,
      dueDate: dto.dueDate ?? null,
      status: ChecklistStatus.PENDING,
      items: this.normalizeItems(dto.items),
    });
    const saved = await this.repo.save(checklist);
    return ChecklistResponseDto.from(saved);
  }

  async update(
    actor: ActorContext,
    id: string,
    dto: UpdateChecklistDto,
  ): Promise<ChecklistResponseDto> {
    const checklist = await this.findEntity(actor.businessId, id);

    // Re-resolve assignment if any of the three relevant fields are touched.
    if (
      dto.assignmentType !== undefined ||
      dto.assignedToId !== undefined ||
      dto.assignedToName !== undefined
    ) {
      const { assignedToId, assignedToName } = await this.resolveAssignment(
        actor.businessId,
        dto.assignmentType ?? checklist.assignmentType,
        dto.assignedToId ?? checklist.assignedToId ?? undefined,
        dto.assignedToName ?? checklist.assignedToName ?? undefined,
      );
      checklist.assignmentType = dto.assignmentType ?? checklist.assignmentType;
      checklist.assignedToId = assignedToId;
      checklist.assignedToName = assignedToName;
    }

    if (dto.name !== undefined) checklist.name = dto.name;
    if (dto.description !== undefined)
      checklist.description = dto.description ?? null;
    if (dto.storeId !== undefined) checklist.storeId = dto.storeId;
    if (dto.frequency !== undefined) checklist.frequency = dto.frequency;
    if (dto.dueTime !== undefined) checklist.dueTime = dto.dueTime ?? null;
    if (dto.dueDate !== undefined) checklist.dueDate = dto.dueDate ?? null;
    if (dto.items !== undefined) {
      checklist.items = this.normalizeItems(dto.items, checklist.items);
      checklist.status = this.deriveStatus(checklist.items);
    }

    const saved = await this.repo.save(checklist);
    return ChecklistResponseDto.from(saved);
  }

  async toggleItem(
    actor: ActorContext,
    checklistId: string,
    itemId: string,
    dto: ToggleChecklistItemDto,
  ): Promise<ChecklistResponseDto> {
    const checklist = await this.findEntity(actor.businessId, checklistId);
    const items = checklist.items ?? [];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) throw new NotFoundException('Checklist item not found');

    const completedByName =
      actor.sub_type === 'staff'
        ? actor.actorName ?? null
        : actor.actorName ?? 'Admin';

    items[idx] = {
      ...items[idx],
      isCompleted: dto.isCompleted,
      completedAt: dto.isCompleted ? new Date().toISOString() : null,
      completedBy: dto.isCompleted ? actor.sub : null,
      completedByName: dto.isCompleted ? completedByName : null,
    };

    checklist.items = items;
    checklist.status = this.deriveStatus(items);
    const saved = await this.repo.save(checklist);
    return ChecklistResponseDto.from(saved);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const checklist = await this.findEntity(actor.businessId, id);
    await this.repo.softRemove(checklist);
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<ChecklistEntity> {
    const c = await this.repo.findOne({ where: { id, businessId } });
    if (!c) throw new NotFoundException('Checklist not found');
    return c;
  }

  /** Validates the assignment target and computes a display label. */
  private async resolveAssignment(
    businessId: string,
    assignmentType: ChecklistAssignmentType,
    assignedToId: string | undefined,
    assignedToName: string | undefined,
  ): Promise<{ assignedToId: string | null; assignedToName: string }> {
    if (assignmentType === ChecklistAssignmentType.ALL_STAFF) {
      return { assignedToId: null, assignedToName: assignedToName ?? 'All Staff' };
    }
    if (!assignedToId) {
      throw new BadRequestException(
        `assignedToId is required when assignmentType=${assignmentType}`,
      );
    }
    if (assignmentType === ChecklistAssignmentType.ROLE) {
      // RoleEntity is store-scoped (not business-scoped). Lookup by id and
      // trust the merchant-hub's role picker to only surface this business's
      // roles — the checklist already carries its own businessId.
      const role = await this.roleRepo.findOne({
        where: { id: assignedToId },
      });
      if (!role) throw new NotFoundException('Role not found');
      return { assignedToId, assignedToName: assignedToName ?? role.name };
    }
    // STAFF
    const staff = await this.staffRepo.findOne({
      where: { id: assignedToId },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return {
      assignedToId,
      assignedToName:
        assignedToName ?? `${staff.firstName} ${staff.lastName}`.trim(),
    };
  }

  /** Stamps UUIDs on new items, preserves completion state for existing
   *  ones across edits, and sorts by `order`. */
  private normalizeItems(
    items: ChecklistItemInputDto[],
    existing: ChecklistItem[] = [],
  ): ChecklistItem[] {
    const existingById = new Map(existing.map((i) => [i.id, i]));
    const out: ChecklistItem[] = items.map((i) => {
      const prior = i.id ? existingById.get(i.id) : undefined;
      return {
        id: i.id ?? randomUUID(),
        title: i.title,
        description: i.description ?? prior?.description,
        isCompleted: i.isCompleted ?? prior?.isCompleted ?? false,
        completedAt: prior?.completedAt ?? null,
        completedBy: prior?.completedBy ?? null,
        completedByName: prior?.completedByName ?? null,
        order: i.order,
      };
    });
    out.sort((a, b) => a.order - b.order);
    return out;
  }

  private deriveStatus(items: ChecklistItem[]): ChecklistStatus {
    if (items.length === 0) return ChecklistStatus.PENDING;
    const done = items.filter((i) => i.isCompleted).length;
    if (done === 0) return ChecklistStatus.PENDING;
    if (done === items.length) return ChecklistStatus.COMPLETED;
    return ChecklistStatus.IN_PROGRESS;
  }
}
