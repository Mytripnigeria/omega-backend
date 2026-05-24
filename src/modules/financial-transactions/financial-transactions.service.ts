import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  FinancialTransactionEntity,
  TransactionLinkedType,
  TransactionMethod,
  TransactionPurpose,
  TransactionType,
} from './entities/financial-transaction.entity';
import {
  FinancialTransactionResponseDto,
  FinancialTransactionStatsDto,
} from './dto/financial-transaction-response.dto';
import { FinancialTransactionFilterDto } from './dto/financial-transaction-filter.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';

export interface RecordTransactionInput {
  businessId: string;
  storeId?: string | null;
  type: TransactionType;
  purpose: TransactionPurpose;
  amount: number;
  method?: TransactionMethod | null;
  currency?: string;
  reference?: string | null;
  description: string;
  linkedType?: TransactionLinkedType;
  linkedId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  staffId?: string | null;
  staffName?: string | null;
}

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
}

@Injectable()
export class FinancialTransactionsService {
  private readonly logger = new Logger(FinancialTransactionsService.name);

  constructor(
    @InjectRepository(FinancialTransactionEntity)
    private readonly repo: Repository<FinancialTransactionEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  /**
   * Record a money movement. When a `manager` is supplied, the row is written
   * inside the caller's transaction so that ledger writes share the same
   * commit boundary as the source-of-truth update — preventing orphaned rows.
   */
  async record(
    input: RecordTransactionInput,
    manager?: EntityManager,
  ): Promise<FinancialTransactionEntity> {
    const repo = manager
      ? manager.getRepository(FinancialTransactionEntity)
      : this.repo;
    const entity = repo.create({
      businessId: input.businessId,
      storeId: input.storeId ?? null,
      type: input.type,
      purpose: input.purpose,
      amount: input.amount,
      method: input.method ?? null,
      currency: input.currency ?? 'NGN',
      reference: input.reference ?? null,
      description: input.description,
      linkedType: input.linkedType ?? null,
      linkedId: input.linkedId ?? null,
      customerId: input.customerId ?? null,
      customerName: input.customerName ?? null,
      staffId: input.staffId ?? null,
      staffName: input.staffName ?? null,
    });
    return repo.save(entity);
  }

  async findAll(
    actor: ActorContext,
    filter: FinancialTransactionFilterDto,
  ): Promise<PaginatedResponseDto<FinancialTransactionResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId: actor.businessId })
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('t.storeId = :storeId', { storeId: filter.storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('t.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.type) qb.andWhere('t.type = :type', { type: filter.type });
    if (filter.customerId)
      qb.andWhere('t.customerId = :customerId', { customerId: filter.customerId });
    if (filter.linkedId)
      qb.andWhere('t.linkedId = :linkedId', { linkedId: filter.linkedId });

    if (filter.purpose) {
      const purposes = filter.purpose
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (purposes.length)
        qb.andWhere('t.purpose IN (:...purposes)', { purposes });
    }
    if (filter.method) {
      const methods = filter.method
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (methods.length) qb.andWhere('t.method IN (:...methods)', { methods });
    }

    if (filter.search) {
      qb.andWhere(
        '(t.description ILIKE :search OR t.reference ILIKE :search OR t.customerName ILIKE :search OR t.staffName ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter.dateFrom) qb.andWhere('t.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo)
      qb.andWhere('t.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, FinancialTransactionResponseDto.from);
  }

  async findOne(
    actor: ActorContext,
    id: string,
  ): Promise<FinancialTransactionResponseDto | null> {
    const tx = await this.repo.findOne({ where: { id } });
    if (!tx) return null;
    if (tx.businessId !== actor.businessId) return null;
    if (actor.sub_type === 'staff' && actor.storeId && tx.storeId !== actor.storeId)
      return null;
    return FinancialTransactionResponseDto.from(tx);
  }

  async getStats(
    actor: ActorContext,
    filter: FinancialTransactionFilterDto,
  ): Promise<FinancialTransactionStatsDto> {
    const baseQb = this.repo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId: actor.businessId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      baseQb.andWhere('t.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.storeId) baseQb.andWhere('t.storeId = :storeId', { storeId: filter.storeId });
    if (filter.dateFrom) baseQb.andWhere('t.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo)
      baseQb.andWhere('t.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    // Use parameter names that don't collide with the base query's `:dt`
    // (dateTo) / `:df` (dateFrom). Reusing `:dt` for the debit type overwrote
    // the dateTo bind → `t.createdAt <= 'debit'` → 500 whenever dateTo was set.
    const credits = await baseQb
      .clone()
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .andWhere('t.type = :creditType', { creditType: 'credit' })
      .getRawOne<{ total: string }>();
    const debits = await baseQb
      .clone()
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .andWhere('t.type = :debitType', { debitType: 'debit' })
      .getRawOne<{ total: string }>();

    const byMethodRaw = await baseQb
      .clone()
      .select('t.method', 'method')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
      .groupBy('t.method')
      .getRawMany<{ method: string | null; total: string }>();
    const byPurposeRaw = await baseQb
      .clone()
      .select('t.purpose', 'purpose')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
      .groupBy('t.purpose')
      .getRawMany<{ purpose: string; total: string }>();

    const byMethod: Record<string, number> = {};
    for (const r of byMethodRaw)
      byMethod[r.method ?? 'unknown'] = Number(r.total);
    const byPurpose: Record<string, number> = {};
    for (const r of byPurposeRaw) byPurpose[r.purpose] = Number(r.total);

    // "Pending" = sum of (total - paidAmount) for non-cancelled, non-completed orders.
    const pendingRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total - o.paidAmount), 0)', 'total')
      .where('o.businessId = :businessId', { businessId: actor.businessId })
      .andWhere('o.status NOT IN (:...closed)', {
        closed: [OrderStatus.CANCELLED, OrderStatus.COMPLETED],
      })
      .andWhere('o.total > o.paidAmount')
      .getRawOne<{ total: string }>();

    return {
      totalIn: Number(credits?.total ?? 0),
      totalOut: Number(debits?.total ?? 0),
      pending: Number(pendingRow?.total ?? 0),
      byMethod,
      byPurpose,
    };
  }
}
