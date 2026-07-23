import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MerchantWalletEntity } from './entities/merchant-wallet.entity';
import {
  MerchantWalletTransactionEntity,
  MerchantWalletTxReason,
  MerchantWalletTxType,
} from './entities/merchant-wallet-transaction.entity';
import {
  MerchantWalletResponseDto,
  MerchantWalletTxFilterDto,
  MerchantWalletTxResponseDto,
} from './dto/merchant-wallet.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';

interface MovementInput {
  businessId: string;
  type: MerchantWalletTxType;
  reason: MerchantWalletTxReason;
  amount: number;
  description: string;
  linkedType?: 'order' | 'payout' | null;
  linkedId?: string | null;
  storeId?: string | null;
  /**
   * When true, a debit is allowed even if it pushes the available balance
   * negative. Used for refunds — the merchant has to absorb the cost even
   * if they've already withdrawn the cash.
   */
  allowOverdraft?: boolean;
}

@Injectable()
export class MerchantWalletService {
  constructor(
    @InjectRepository(MerchantWalletEntity)
    private readonly walletRepo: Repository<MerchantWalletEntity>,
    @InjectRepository(MerchantWalletTransactionEntity)
    private readonly txRepo: Repository<MerchantWalletTransactionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getWallet(businessId: string): Promise<MerchantWalletResponseDto> {
    return MerchantWalletResponseDto.from(await this.getOrCreate(businessId));
  }

  async listTransactions(
    businessId: string,
    filter: MerchantWalletTxFilterDto,
  ): Promise<PaginatedResponseDto<MerchantWalletTxResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId })
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filter.type) qb.andWhere('t.type = :type', { type: filter.type });
    if (filter.reason) qb.andWhere('t.reason = :reason', { reason: filter.reason });
    if (filter.linkedId)
      qb.andWhere('t.linkedId = :linkedId', { linkedId: filter.linkedId });
    if (filter.dateFrom)
      qb.andWhere('t.createdAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo)
      qb.andWhere('t.createdAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [rows, total] = await qb.getManyAndCount();
    return paginate(
      rows,
      total,
      page,
      limit,
      MerchantWalletTxResponseDto.from,
    );
  }

  /**
   * Credit the merchant wallet. Uses the caller's `EntityManager` if supplied
   * (so the credit commits with whatever else is happening, e.g. the order
   * mark-paid transaction); otherwise opens its own.
   */
  credit(input: Omit<MovementInput, 'type'>, manager?: EntityManager) {
    return this.runMovement({ ...input, type: 'credit' }, manager);
  }

  /**
   * Debit the merchant wallet. Caller must hold a lock on the wallet row
   * (acquired via `getOrCreate(..., {lock: true})`) — debits beyond available
   * balance throw `BadRequestException`.
   */
  debit(input: Omit<MovementInput, 'type'>, manager?: EntityManager) {
    return this.runMovement({ ...input, type: 'debit' }, manager);
  }

  /**
   * Reserve funds for an in-flight payout. Increases `reservedBalance`
   * without changing `balance`. Available = balance - reservedBalance.
   */
  async reserve(
    businessId: string,
    amount: number,
    linkedId: string,
    description: string,
    manager?: EntityManager,
  ): Promise<void> {
    const work = async (mgr: EntityManager) => {
      const wallet = await this.lockWallet(businessId, mgr);
      const available =
        Number(wallet.balance) - Number(wallet.reservedBalance);
      if (amount > available + 0.001) {
        throw new BadRequestException(
          `Insufficient available balance — ₦${available.toLocaleString()} available, ₦${amount.toLocaleString()} requested`,
        );
      }
      wallet.reservedBalance = Number(wallet.reservedBalance) + amount;
      await mgr.getRepository(MerchantWalletEntity).save(wallet);

      // Audit row only — the balance doesn't change on reserve.
      await mgr.getRepository(MerchantWalletTransactionEntity).save(
        mgr.getRepository(MerchantWalletTransactionEntity).create({
          businessId,
          walletId: wallet.id,
          type: 'debit',
          reason: 'payout_reserved',
          amount,
          balanceAfter: Number(wallet.balance),
          description,
          linkedType: 'payout',
          linkedId,
        }),
      );
    };
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  /**
   * Release a previously reserved amount back to the available pool (e.g. a
   * queued payout was cancelled before it transferred).
   */
  async releaseReservation(
    businessId: string,
    amount: number,
    linkedId: string,
    description: string,
    manager?: EntityManager,
  ): Promise<void> {
    const work = async (mgr: EntityManager) => {
      const wallet = await this.lockWallet(businessId, mgr);
      wallet.reservedBalance = Math.max(
        0,
        Number(wallet.reservedBalance) - amount,
      );
      await mgr.getRepository(MerchantWalletEntity).save(wallet);
      await mgr.getRepository(MerchantWalletTransactionEntity).save(
        mgr.getRepository(MerchantWalletTransactionEntity).create({
          businessId,
          walletId: wallet.id,
          type: 'credit',
          reason: 'payout_released',
          amount,
          balanceAfter: Number(wallet.balance),
          description,
          linkedType: 'payout',
          linkedId,
        }),
      );
    };
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  /**
   * Settle a payout: debit the wallet for the reserved amount and clear the
   * matching reservation. Called when a transfer succeeds.
   */
  async settlePayout(
    businessId: string,
    amount: number,
    linkedId: string,
    description: string,
    manager?: EntityManager,
  ): Promise<void> {
    const work = async (mgr: EntityManager) => {
      const wallet = await this.lockWallet(businessId, mgr);
      wallet.reservedBalance = Math.max(
        0,
        Number(wallet.reservedBalance) - amount,
      );
      wallet.balance = Math.max(0, Number(wallet.balance) - amount);
      await mgr.getRepository(MerchantWalletEntity).save(wallet);
      await mgr.getRepository(MerchantWalletTransactionEntity).save(
        mgr.getRepository(MerchantWalletTransactionEntity).create({
          businessId,
          walletId: wallet.id,
          type: 'debit',
          reason: 'payout_settled',
          amount,
          balanceAfter: Number(wallet.balance),
          description,
          linkedType: 'payout',
          linkedId,
        }),
      );
    };
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async getOrCreate(
    businessId: string,
  ): Promise<MerchantWalletEntity> {
    let wallet = await this.walletRepo.findOne({ where: { businessId } });
    if (!wallet) {
      wallet = this.walletRepo.create({ businessId });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  private async lockWallet(
    businessId: string,
    mgr: EntityManager,
  ): Promise<MerchantWalletEntity> {
    let wallet = await mgr
      .getRepository(MerchantWalletEntity)
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.businessId = :businessId', { businessId })
      .getOne();
    if (!wallet) {
      // Lazily create + immediately re-lock so concurrent callers all see it.
      wallet = mgr.getRepository(MerchantWalletEntity).create({ businessId });
      wallet = await mgr.getRepository(MerchantWalletEntity).save(wallet);
      wallet = await mgr
        .getRepository(MerchantWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: wallet.id })
        .getOne();
      if (!wallet) throw new NotFoundException('Could not lock wallet');
    }
    return wallet;
  }

  private async runMovement(
    input: MovementInput,
    manager?: EntityManager,
  ): Promise<void> {
    if (input.amount <= 0) return;
    const work = async (mgr: EntityManager) => {
      const wallet = await this.lockWallet(input.businessId, mgr);
      if (input.type === 'credit') {
        wallet.balance = Number(wallet.balance) + input.amount;
      } else {
        const available =
          Number(wallet.balance) - Number(wallet.reservedBalance);
        if (!input.allowOverdraft && input.amount > available + 0.001) {
          throw new BadRequestException(
            `Insufficient available balance — ₦${available.toLocaleString()} available, ₦${input.amount.toLocaleString()} requested`,
          );
        }
        wallet.balance = Number(wallet.balance) - input.amount;
      }
      await mgr.getRepository(MerchantWalletEntity).save(wallet);
      await mgr.getRepository(MerchantWalletTransactionEntity).save(
        mgr.getRepository(MerchantWalletTransactionEntity).create({
          businessId: input.businessId,
          walletId: wallet.id,
          type: input.type,
          reason: input.reason,
          amount: input.amount,
          balanceAfter: Number(wallet.balance),
          description: input.description,
          linkedType: input.linkedType ?? null,
          linkedId: input.linkedId ?? null,
          storeId: input.storeId ?? null,
        }),
      );
    };
    return manager ? work(manager) : this.dataSource.transaction(work);
  }
}
