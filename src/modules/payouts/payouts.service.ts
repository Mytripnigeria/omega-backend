import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PayoutEntity } from './entities/payout.entity';
import { PayoutBankAccountEntity } from './entities/payout-bank-account.entity';
import {
  CreatePayoutBankAccountDto,
  CreatePayoutDto,
  PayoutBankAccountResponseDto,
  PayoutFilterDto,
  PayoutResponseDto,
  PayoutStatsDto,
  UpdatePayoutBankAccountDto,
} from './dto/payout.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { MerchantWalletService } from '../merchant-wallet/merchant-wallet.service';
import { PaystackService } from '../paystack/paystack.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';

export const PAYOUTS_QUEUE = 'payouts';

interface ActorContext {
  sub: string;
  businessId: string;
  actorName?: string;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(PayoutEntity)
    private readonly payoutRepo: Repository<PayoutEntity>,
    @InjectRepository(PayoutBankAccountEntity)
    private readonly bankRepo: Repository<PayoutBankAccountEntity>,
    @InjectQueue(PAYOUTS_QUEUE)
    private readonly queue: Queue,
    private readonly dataSource: DataSource,
    private readonly wallet: MerchantWalletService,
    private readonly paystack: PaystackService,
    private readonly integrations: IntegrationsService,
    private readonly activityLog: ActivityLogService,
    private readonly ledger: FinancialTransactionsService,
  ) {}

  /**
   * This merchant's own Paystack secret (from dashboard → Integrations).
   * Payouts move funds from the merchant's own Paystack balance, so they use
   * the merchant's key — never a platform key or another merchant's.
   */
  private async paystackSecret(businessId: string): Promise<string> {
    const cred = await this.integrations.getActiveCredential(
      businessId,
      'paystack',
    );
    if (!cred?.secretKey) {
      throw new BadRequestException(
        'Paystack is not configured for this business. Add your Paystack keys in Settings → Integrations.',
      );
    }
    return cred.secretKey;
  }

  // ─── Bank accounts ──────────────────────────────────────────────────

  async listBankAccounts(
    businessId: string,
  ): Promise<PayoutBankAccountResponseDto[]> {
    const rows = await this.bankRepo.find({
      where: { businessId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return rows.map(PayoutBankAccountResponseDto.from);
  }

  async createBankAccount(
    actor: ActorContext,
    dto: CreatePayoutBankAccountDto,
  ): Promise<PayoutBankAccountResponseDto> {
    // Register with Paystack first — if they reject the account, don't save it.
    let recipient: {
      recipientCode: string;
      bankName: string | null;
      accountName: string | null;
    } | null = null;
    try {
      recipient = await this.paystack.createTransferRecipient(
        {
          name: dto.label,
          accountNumber: dto.accountNumber,
          bankCode: dto.bankCode,
        },
        await this.paystackSecret(actor.businessId),
      );
    } catch (err) {
      this.logger.warn(
        `Recipient registration failed for ${dto.accountNumber}: ${(err as Error).message}. Saving without recipient code; payouts to this account will fail until it's re-registered.`,
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      if (dto.isDefault) {
        await mgr
          .getRepository(PayoutBankAccountEntity)
          .update({ businessId: actor.businessId }, { isDefault: false });
      }
      const entity = mgr.getRepository(PayoutBankAccountEntity).create({
        businessId: actor.businessId,
        label: dto.label,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: recipient?.bankName ?? null,
        accountName: recipient?.accountName ?? null,
        recipientCode: recipient?.recipientCode ?? null,
        isDefault: dto.isDefault ?? false,
      });
      const saved = await mgr.getRepository(PayoutBankAccountEntity).save(entity);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.actorName ?? 'Admin',
        action: 'payout.bank_account_added',
        businessId: actor.businessId,
        resourceType: 'payout_bank_account',
        resourceId: saved.id,
        metadata: { label: saved.label },
      });

      return PayoutBankAccountResponseDto.from(saved);
    });
  }

  async updateBankAccount(
    actor: ActorContext,
    id: string,
    dto: UpdatePayoutBankAccountDto,
  ): Promise<PayoutBankAccountResponseDto> {
    const acct = await this.bankRepo.findOne({
      where: { id, businessId: actor.businessId },
    });
    if (!acct) throw new NotFoundException('Bank account not found');
    return this.dataSource.transaction(async (mgr) => {
      if (dto.isDefault === true) {
        await mgr
          .getRepository(PayoutBankAccountEntity)
          .update({ businessId: actor.businessId }, { isDefault: false });
      }
      Object.assign(acct, dto);
      const saved = await mgr.getRepository(PayoutBankAccountEntity).save(acct);
      return PayoutBankAccountResponseDto.from(saved);
    });
  }

  async removeBankAccount(actor: ActorContext, id: string): Promise<void> {
    const acct = await this.bankRepo.findOne({
      where: { id, businessId: actor.businessId },
    });
    if (!acct) throw new NotFoundException('Bank account not found');
    // Refuse to delete if a payout is currently in flight against it.
    const inFlight = await this.payoutRepo
      .createQueryBuilder('p')
      .where('p.bankAccountId = :id', { id })
      .andWhere('p.status IN (:...statuses)', {
        statuses: ['pending', 'queued', 'processing'],
      })
      .getCount();
    if (inFlight > 0) {
      throw new ConflictException(
        'This account has in-flight payouts. Wait until they complete before removing it.',
      );
    }
    await this.bankRepo.softRemove(acct);
  }

  // ─── Payouts ────────────────────────────────────────────────────────

  async list(
    businessId: string,
    filter: PayoutFilterDto,
  ): Promise<PaginatedResponseDto<PayoutResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.payoutRepo
      .createQueryBuilder('p')
      .where('p.businessId = :businessId', { businessId })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filter.status) qb.andWhere('p.status = :status', { status: filter.status });
    if (filter.dateFrom)
      qb.andWhere('p.createdAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo)
      qb.andWhere('p.createdAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

    const [rows, total] = await qb.getManyAndCount();
    // Fetch related bank accounts in one query.
    const bankIds = Array.from(new Set(rows.map((r) => r.bankAccountId)));
    const banks = bankIds.length
      ? await this.bankRepo.find({
          where: bankIds.map((id) => ({ id })),
          withDeleted: true,
        })
      : [];
    const bankById = new Map(banks.map((b) => [b.id, b]));
    return paginate(rows, total, page, limit, (r) =>
      PayoutResponseDto.from(r, bankById.get(r.bankAccountId) ?? null),
    );
  }

  async findOne(businessId: string, id: string): Promise<PayoutResponseDto> {
    const payout = await this.payoutRepo.findOne({
      where: { id, businessId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    const bank = await this.bankRepo.findOne({
      where: { id: payout.bankAccountId },
      withDeleted: true,
    });
    return PayoutResponseDto.from(payout, bank);
  }

  async getStats(businessId: string): Promise<PayoutStatsDto> {
    const totalPaidOutRow = await this.payoutRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.businessId = :businessId', { businessId })
      .andWhere('p.status = :s', { s: 'success' })
      .getRawOne<{ sum: string }>();
    const totalPendingRow = await this.payoutRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.businessId = :businessId', { businessId })
      .andWhere('p.status IN (:...statuses)', {
        statuses: ['pending', 'queued', 'processing'],
      })
      .getRawOne<{ sum: string }>();
    const [successCount, failedCount, inFlightCount] = await Promise.all([
      this.payoutRepo.count({ where: { businessId, status: 'success' } }),
      this.payoutRepo.count({ where: { businessId, status: 'failed' } }),
      this.payoutRepo
        .createQueryBuilder('p')
        .where('p.businessId = :businessId', { businessId })
        .andWhere('p.status IN (:...statuses)', {
          statuses: ['pending', 'queued', 'processing'],
        })
        .getCount(),
    ]);
    return {
      totalPaidOut: Number(totalPaidOutRow?.sum ?? 0),
      totalPending: Number(totalPendingRow?.sum ?? 0),
      successCount,
      failedCount,
      inFlightCount,
    };
  }

  /**
   * Customer-initiated payout request. Reserves the amount on the merchant
   * wallet (rejects if insufficient available balance) and enqueues for the
   * worker to pick up.
   */
  async create(
    actor: ActorContext,
    dto: CreatePayoutDto,
  ): Promise<PayoutResponseDto> {
    const bank = await this.bankRepo.findOne({
      where: { id: dto.bankAccountId, businessId: actor.businessId },
    });
    if (!bank) throw new NotFoundException('Bank account not found');
    if (!bank.recipientCode) {
      throw new BadRequestException(
        'This bank account is not registered with the payment provider yet. Re-add it to retry registration.',
      );
    }

    const reference = `PAYOUT_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const payout = await this.dataSource.transaction(async (mgr) => {
      // Reserve the funds first — if the wallet doesn't have it, this throws
      // and nothing else happens.
      await this.wallet.reserve(
        actor.businessId,
        dto.amount,
        '__pending__', // overwritten below
        `Payout reserved (${reference})`,
        mgr,
      );

      const entity = mgr.getRepository(PayoutEntity).create({
        businessId: actor.businessId,
        reference,
        bankAccountId: bank.id,
        amount: dto.amount,
        currency: bank.currency,
        status: 'pending',
        requestedById: actor.sub,
        requestedByName: actor.actorName ?? null,
        note: dto.note ?? null,
      });
      return mgr.getRepository(PayoutEntity).save(entity);
    });

    // Enqueue outside the DB transaction so a Redis blip doesn't block the
    // payout being created. The worker picks up `pending` rows even if the
    // enqueue fails (we re-enqueue on next manual reconcile).
    try {
      await this.queue.add(
        'process-payout',
        { payoutId: payout.id },
        {
          jobId: payout.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      await this.payoutRepo.update(payout.id, {
        status: 'queued',
        queuedAt: new Date(),
      });
      payout.status = 'queued';
      payout.queuedAt = new Date();
    } catch (err) {
      this.logger.error(
        `Failed to enqueue payout ${payout.id}: ${(err as Error).message}. It stays in 'pending' for a manual retry.`,
      );
    }

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.actorName ?? 'Admin',
      action: 'payout.requested',
      businessId: actor.businessId,
      resourceType: 'payout',
      resourceId: payout.id,
      metadata: { amount: Number(payout.amount), reference: payout.reference },
    });

    return this.findOne(actor.businessId, payout.id);
  }

  /**
   * Worker entry point — picks the payout up, locks the row, calls the
   * payment provider, and persists the resulting status. Idempotent:
   * already-finalised payouts return early. Webhook arrivals re-enter
   * the same flow via {@link applyWebhookOutcome}.
   */
  async processPayout(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.id = :id', { id: payoutId })
      .getOne();
    if (!payout) {
      this.logger.warn(`Payout ${payoutId} not found — skipping`);
      return;
    }
    if (
      payout.status === 'success' ||
      payout.status === 'failed' ||
      payout.status === 'cancelled'
    ) {
      return;
    }

    const bank = await this.bankRepo.findOne({
      where: { id: payout.bankAccountId },
      withDeleted: true,
    });
    if (!bank?.recipientCode) {
      await this.markFailed(
        payout,
        'Bank account is missing a Paystack recipient code',
      );
      return;
    }

    payout.status = 'processing';
    payout.processingAt = new Date();
    await this.payoutRepo.save(payout);

    try {
      const result = await this.paystack.transfer(
        {
          recipientCode: bank.recipientCode,
          amount: Math.round(Number(payout.amount) * 100), // kobo
          reference: payout.reference,
          reason: payout.note ?? `Payout ${payout.reference}`,
        },
        await this.paystackSecret(payout.businessId),
      );
      payout.providerTransferCode = result.transferCode;
      payout.providerStatus = result.status;
      await this.payoutRepo.save(payout);

      // Paystack returns `success` immediately for some accounts and
      // `pending` otherwise (where the webhook will close it out).
      if (result.status === 'success') {
        await this.markSuccess(payout);
      }
      // Otherwise we wait for the webhook to fire.
    } catch (err) {
      await this.markFailed(payout, (err as Error).message);
    }
  }

  /**
   * Idempotent webhook handler — flips a transfer to success or failed and
   * settles/refunds the wallet accordingly.
   */
  async applyWebhookOutcome(
    reference: string,
    outcome: 'success' | 'failed',
    reason?: string,
  ): Promise<void> {
    const payout = await this.payoutRepo.findOne({ where: { reference } });
    if (!payout) return;
    if (payout.status === 'success' || payout.status === 'failed') return;
    if (outcome === 'success') {
      await this.markSuccess(payout);
    } else {
      await this.markFailed(payout, reason ?? 'Transfer failed');
    }
  }

  private async markSuccess(payout: PayoutEntity): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      payout.status = 'success';
      payout.providerStatus = 'success';
      payout.settledAt = new Date();
      await mgr.getRepository(PayoutEntity).save(payout);
      // Move the reserved funds out: debit and clear reservation.
      await this.wallet.settlePayout(
        payout.businessId,
        Number(payout.amount),
        payout.id,
        `Payout ${payout.reference} settled`,
        mgr,
      );
      // Mirror into the financial-transactions ledger so the settled payout
      // shows on the merchant Transactions page ("Payout" purpose filter).
      await this.ledger.record(
        {
          businessId: payout.businessId,
          type: 'debit',
          purpose: 'payout',
          amount: Number(payout.amount),
          method: 'transfer',
          currency: payout.currency ?? 'NGN',
          reference: payout.reference,
          description: `Payout ${payout.reference} settled`,
        },
        mgr,
      );
    });
    this.activityLog.record({
      actorType: 'system',
      actorId: null,
      actorName: 'system',
      action: 'payout.settled',
      businessId: payout.businessId,
      resourceType: 'payout',
      resourceId: payout.id,
      metadata: { amount: Number(payout.amount), reference: payout.reference },
    });
  }

  private async markFailed(
    payout: PayoutEntity,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      payout.status = 'failed';
      payout.failureReason = reason;
      payout.providerStatus = 'failed';
      await mgr.getRepository(PayoutEntity).save(payout);
      // Release the reservation — funds return to available balance.
      await this.wallet.releaseReservation(
        payout.businessId,
        Number(payout.amount),
        payout.id,
        `Payout ${payout.reference} failed: ${reason}`,
        mgr,
      );
    });
    this.activityLog.record({
      actorType: 'system',
      actorId: null,
      actorName: 'system',
      action: 'payout.failed',
      businessId: payout.businessId,
      resourceType: 'payout',
      resourceId: payout.id,
      metadata: {
        amount: Number(payout.amount),
        reference: payout.reference,
        reason,
      },
    });
  }
}
