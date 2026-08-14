import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExpenseEntity,
  ExpenseItem,
  ExpenseStatus,
} from './entities/expense.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import {
  CreateExpenseDto,
  ExpenseFilterDto,
  ExpenseItemDto,
  MarkPaidExpenseDto,
  ReviewExpenseDto,
  UpdateExpenseDto,
} from './dto/expense-dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { StorageService } from '../storage/storage.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

/**
 * Cleans a submitted line-item list: drops blank rows, rounds money to kobo and
 * computes each line total server-side so a client can't post a total that
 * doesn't match its own quantity × unit price.
 */
function normaliseExpenseItems(
  items: ExpenseItemDto[] | undefined,
  fallbackSupplier?: string,
): ExpenseItem[] | null {
  if (!items?.length) return null;
  const cleaned = items
    .filter((i) => i.name?.trim())
    .map((i) => {
      const quantity = Number(i.quantity) || 0;
      const unitPrice = Number(i.unitPrice) || 0;
      return {
        name: i.name.trim(),
        type: i.type,
        unit: i.unit?.trim() || null,
        quantity,
        unitPrice,
        total: Math.round(quantity * unitPrice * 100) / 100,
        supplier: i.supplier?.trim() || fallbackSupplier?.trim() || null,
      };
    });
  return cleaned.length > 0 ? cleaned : null;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(ExpenseEntity)
    private readonly repo: Repository<ExpenseEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly ledger: FinancialTransactionsService,
  ) {}

  async create(actor: ActorContext, dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    if (actor.sub_type !== 'staff' || !actor.storeId) {
      throw new ForbiddenException('Only staff can submit expense requests');
    }

    const staff = await this.staffRepo.findOne({ where: { id: actor.sub } });
    if (!staff) throw new NotFoundException('Submitter staff record not found');

    let receiptUrl: string | null = null;
    if (dto.receiptFileId) {
      const file = await this.storage.findById(dto.receiptFileId);
      receiptUrl = file.url;
    }

    const items = normaliseExpenseItems(dto.items, dto.supplierName);
    if (!items && !dto.description?.trim()) {
      throw new BadRequestException(
        'Add at least one item, or a description of the expense',
      );
    }

    const expense = this.repo.create({
      businessId: actor.businessId,
      storeId: actor.storeId,
      requestedById: staff.id,
      requestedByName: `${staff.firstName} ${staff.lastName}`,
      category: dto.category,
      // An itemised submission's total is always the sum of its lines, so the
      // stored amount can't disagree with what it's made of.
      amount: items
        ? items.reduce((sum, i) => sum + i.total, 0)
        : (dto.amount ?? 0),
      currency: dto.currency ?? 'NGN',
      description: dto.description ?? null,
      items,
      supplierName: dto.supplierName ?? null,
      receiptFileId: dto.receiptFileId ?? null,
      receiptUrl,
      status: ExpenseStatus.PENDING,
    });
    const saved = await this.repo.save(expense);

    this.activityLog.record({
      actorType: 'staff',
      actorId: staff.id,
      actorName: `${staff.firstName} ${staff.lastName}`,
      action: 'expense.submitted',
      businessId: actor.businessId,
      storeId: actor.storeId,
      resourceType: 'expense',
      resourceId: saved.id,
      metadata: { amount: dto.amount, category: dto.category },
    });

    return ExpenseResponseDto.from(saved);
  }

  async findAll(
    actor: ActorContext,
    filter: ExpenseFilterDto,
    scope?: { requestedById?: string },
  ): Promise<PaginatedResponseDto<ExpenseResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.businessId = :businessId', { businessId: actor.businessId })
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('e.storeId = :storeId', { storeId: filter.storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('e.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (scope?.requestedById) qb.andWhere('e.requestedById = :rid', { rid: scope.requestedById });
    if (filter.requestedById) qb.andWhere('e.requestedById = :rid2', { rid2: filter.requestedById });
    if (filter.category) qb.andWhere('e.category = :cat', { cat: filter.category });

    if (filter.status) {
      const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) qb.andWhere('e.status IN (:...statuses)', { statuses });
    }

    if (filter.search) {
      qb.andWhere(
        '(e.description ILIKE :search OR e.requestedByName ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter.dateFrom) qb.andWhere('e.createdAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo) qb.andWhere('e.createdAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, ExpenseResponseDto.from);
  }

  async findMy(
    actor: ActorContext,
    filter: ExpenseFilterDto,
  ): Promise<PaginatedResponseDto<ExpenseResponseDto>> {
    if (actor.sub_type !== 'staff') {
      throw new ForbiddenException('Only staff can list their own expenses');
    }
    return this.findAll(actor, filter, { requestedById: actor.sub });
  }

  async findOne(actor: ActorContext, id: string): Promise<ExpenseResponseDto> {
    return ExpenseResponseDto.from(await this.findEntity(actor, id));
  }

  private async findEntity(actor: ActorContext, id: string): Promise<ExpenseEntity> {
    const expense = await this.repo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    if (expense.businessId !== actor.businessId) {
      throw new ForbiddenException('Expense belongs to another business');
    }
    if (
      actor.sub_type === 'staff' &&
      actor.storeId &&
      expense.storeId !== actor.storeId
    ) {
      throw new ForbiddenException('Expense belongs to another store');
    }
    return expense;
  }

  async update(
    actor: ActorContext,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.findEntity(actor, id);
    if (actor.sub_type === 'staff' && expense.requestedById !== actor.sub) {
      throw new ForbiddenException('You can only edit your own expense requests');
    }
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Only pending expenses can be edited (current: ${expense.status})`);
    }

    if (dto.receiptFileId !== undefined) {
      if (dto.receiptFileId === null) {
        expense.receiptFileId = null;
        expense.receiptUrl = null;
      } else {
        const file = await this.storage.findById(dto.receiptFileId);
        expense.receiptFileId = file.id;
        expense.receiptUrl = file.url;
      }
    }
    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.description !== undefined) expense.description = dto.description;
    if (dto.supplierName !== undefined) expense.supplierName = dto.supplierName;

    if (dto.items !== undefined) {
      expense.items = normaliseExpenseItems(
        dto.items,
        dto.supplierName ?? expense.supplierName ?? undefined,
      );
    }
    // The total follows the lines whenever the submission is itemised; an
    // explicit amount only applies to a free-text submission.
    if (expense.items?.length) {
      expense.amount = expense.items.reduce((sum, i) => sum + i.total, 0);
    } else if (dto.amount !== undefined) {
      expense.amount = dto.amount;
    }

    await this.repo.save(expense);
    return ExpenseResponseDto.from(expense);
  }

  async approve(
    actor: ActorContext,
    id: string,
    dto: ReviewExpenseDto,
  ): Promise<ExpenseResponseDto> {
    if (actor.sub_type !== 'admin') {
      throw new ForbiddenException('Admin-only');
    }
    const expense = await this.findEntity(actor, id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Only pending expenses can be approved (current: ${expense.status})`);
    }

    expense.status = ExpenseStatus.APPROVED;
    expense.reviewedById = actor.sub;
    expense.reviewedByName = actor.actorName ?? 'Admin';
    expense.reviewedAt = new Date();
    expense.reviewNotes = dto.notes ?? null;
    await this.repo.save(expense);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'expense.approved',
      businessId: actor.businessId,
      storeId: expense.storeId,
      resourceType: 'expense',
      resourceId: expense.id,
      metadata: { amount: Number(expense.amount), notes: dto.notes ?? null },
    });

    return ExpenseResponseDto.from(expense);
  }

  async reject(
    actor: ActorContext,
    id: string,
    dto: ReviewExpenseDto,
  ): Promise<ExpenseResponseDto> {
    if (actor.sub_type !== 'admin') {
      throw new ForbiddenException('Admin-only');
    }
    const expense = await this.findEntity(actor, id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Only pending expenses can be rejected (current: ${expense.status})`);
    }

    expense.status = ExpenseStatus.REJECTED;
    expense.reviewedById = actor.sub;
    expense.reviewedByName = actor.actorName ?? 'Admin';
    expense.reviewedAt = new Date();
    expense.reviewNotes = dto.notes ?? null;
    await this.repo.save(expense);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'expense.rejected',
      businessId: actor.businessId,
      storeId: expense.storeId,
      resourceType: 'expense',
      resourceId: expense.id,
      metadata: { reason: dto.notes ?? null },
    });

    return ExpenseResponseDto.from(expense);
  }

  async markPaid(
    actor: ActorContext,
    id: string,
    dto: MarkPaidExpenseDto,
  ): Promise<ExpenseResponseDto> {
    if (actor.sub_type !== 'admin') {
      throw new ForbiddenException('Admin-only');
    }
    const expense = await this.findEntity(actor, id);
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(`Only approved expenses can be marked paid (current: ${expense.status})`);
    }

    expense.status = ExpenseStatus.PAID;
    expense.paidAt = new Date();
    if (dto.paymentMethodId) expense.paymentMethodId = dto.paymentMethodId;
    await this.repo.save(expense);

    await this.ledger.record({
      businessId: actor.businessId,
      storeId: expense.storeId,
      type: 'debit',
      purpose: 'expense_payment',
      amount: Number(expense.amount),
      method: 'other',
      description: `Expense paid: ${expense.description}`,
      linkedType: 'expense',
      linkedId: expense.id,
      staffId: actor.sub,
      staffName: actor.actorName ?? null,
    });

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'expense.paid',
      businessId: actor.businessId,
      storeId: expense.storeId,
      resourceType: 'expense',
      resourceId: expense.id,
      metadata: { amount: Number(expense.amount), paymentMethodId: dto.paymentMethodId ?? null },
    });

    return ExpenseResponseDto.from(expense);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const expense = await this.findEntity(actor, id);
    if (actor.sub_type === 'staff' && expense.requestedById !== actor.sub) {
      throw new ForbiddenException('You can only delete your own expense requests');
    }
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(`Only pending expenses can be deleted (current: ${expense.status})`);
    }
    await this.repo.softDelete(id);
  }
}
