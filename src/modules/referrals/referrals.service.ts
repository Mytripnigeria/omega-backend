import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ReferralEntity,
  ReferralRewardType,
  ReferralStatus,
} from './entities/referral.entity';
import { ReferralSettingsEntity } from './entities/referral-settings.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from '../customers/entities/wallet-transaction.entity';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import {
  MyReferralsSummaryDto,
  ReferralFilterDto,
  ReferralResponseDto,
  ReferralSettingsResponseDto,
  ReferralStatsDto,
  UpdateReferralSettingsDto,
} from './dto/referral.dto';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(ReferralEntity)
    private readonly referralRepo: Repository<ReferralEntity>,
    @InjectRepository(ReferralSettingsEntity)
    private readonly settingsRepo: Repository<ReferralSettingsEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly dataSource: DataSource,
    private readonly ledger: FinancialTransactionsService,
  ) {}

  // ─── Settings (lazy-create per business) ────────────────────────────

  async getSettings(businessId: string): Promise<ReferralSettingsResponseDto> {
    return ReferralSettingsResponseDto.from(
      await this.getOrCreateSettings(businessId),
    );
  }

  async updateSettings(
    businessId: string,
    dto: UpdateReferralSettingsDto,
  ): Promise<ReferralSettingsResponseDto> {
    const settings = await this.getOrCreateSettings(businessId);
    Object.assign(settings, dto);
    const saved = await this.settingsRepo.save(settings);
    return ReferralSettingsResponseDto.from(saved);
  }

  private async getOrCreateSettings(
    businessId: string,
  ): Promise<ReferralSettingsEntity> {
    let settings = await this.settingsRepo.findOne({ where: { businessId } });
    if (!settings) {
      settings = this.settingsRepo.create({ businessId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  // ─── Lifecycle hooks (called from auth + orders) ────────────────────

  /**
   * Called from auth.storefrontRegister when a new user signs up with a
   * referral code. Creates a referral record in `signed_up` state and
   * immediately credits the new (referred) customer with their reward.
   * Returns null if the code is invalid / business is misconfigured.
   */
  async recordSignUp(
    businessId: string,
    referredCustomerId: string,
    referralCode: string,
  ): Promise<ReferralEntity | null> {
    const settings = await this.getOrCreateSettings(businessId);
    if (!settings.isActive) return null;

    const referrer = await this.customerRepo.findOne({
      where: { businessId, referralCode: referralCode.trim().toUpperCase() },
    });
    if (!referrer) {
      this.logger.warn(`Referral code "${referralCode}" not recognised`);
      return null;
    }
    if (referrer.id === referredCustomerId) {
      // Self-referral: silently ignore.
      return null;
    }

    // No double-counting: one referral row per (business, referredCustomer).
    const existing = await this.referralRepo.findOne({
      where: { businessId, referredCustomerId },
    });
    if (existing) return existing;

    const expiresAt =
      settings.expiryDays > 0
        ? new Date(Date.now() + settings.expiryDays * 86400_000)
        : null;

    const entity = this.referralRepo.create({
      businessId,
      referrerCustomerId: referrer.id,
      referredCustomerId,
      referralCode: referrer.referralCode,
      status: 'signed_up',
      referrerReward: Number(settings.referrerReward),
      referredReward: Number(settings.referredReward),
      rewardType: settings.rewardType,
      signedUpAt: new Date(),
      expiresAt,
    });
    const saved = await this.referralRepo.save(entity);

    // Mark the new customer as having been referred (entity-level link).
    referredCustomerId &&
      (await this.customerRepo.update(
        { id: referredCustomerId },
        { referredBy: referrer.id },
      ));

    // Credit the referred customer's reward immediately (they get it on signup).
    if (Number(settings.referredReward) > 0) {
      await this.creditReward(
        businessId,
        referredCustomerId,
        Number(settings.referredReward),
        settings.rewardType,
        `Welcome bonus from referral ${referrer.referralCode}`,
        saved.id,
      );
    }

    return saved;
  }

  /**
   * Called from storefront-orders.markOrderPaid when a customer's first paid
   * order completes. Looks up the referral row (if any) tied to this customer
   * and transitions it to `rewarded`, crediting the referrer.
   * Idempotent: subsequent paid orders do nothing.
   */
  async recordFirstPurchase(
    businessId: string,
    referredCustomerId: string,
    orderId: string,
  ): Promise<ReferralEntity | null> {
    const referral = await this.referralRepo.findOne({
      where: { businessId, referredCustomerId },
    });
    if (!referral) return null;
    if (referral.status === 'rewarded' || referral.status === 'expired') {
      return referral;
    }
    if (referral.expiresAt && referral.expiresAt < new Date()) {
      referral.status = 'expired';
      await this.referralRepo.save(referral);
      return referral;
    }

    referral.status = 'rewarded';
    referral.firstOrderId = orderId;
    referral.firstPurchaseAt = new Date();
    referral.rewardedAt = new Date();
    await this.referralRepo.save(referral);

    if (Number(referral.referrerReward) > 0) {
      await this.creditReward(
        businessId,
        referral.referrerCustomerId,
        Number(referral.referrerReward),
        referral.rewardType,
        `Referral bonus — ${referral.referralCode}`,
        referral.id,
      );
    }

    return referral;
  }

  /** Internal: credit a customer with the chosen reward type. */
  private async creditReward(
    businessId: string,
    customerId: string,
    amount: number,
    rewardType: ReferralRewardType,
    description: string,
    referralId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const customer = await mgr
        .getRepository(CustomerEntity)
        .findOne({ where: { id: customerId, businessId } });
      if (!customer) return;

      if (rewardType === 'wallet_credit') {
        const newBalance = Number(customer.walletBalance) + amount;
        customer.walletBalance = newBalance;
        await mgr.getRepository(CustomerEntity).save(customer);

        const tx = await mgr.getRepository(WalletTransactionEntity).save(
          mgr.getRepository(WalletTransactionEntity).create({
            customerId,
            type: WalletTransactionType.CREDIT,
            amount,
            balance: newBalance,
            description,
            reference: `referral:${referralId}`,
          }),
        );

        await this.ledger.record(
          {
            businessId,
            type: 'credit',
            purpose: 'wallet_credit',
            amount,
            method: 'wallet',
            reference: `referral:${referralId}`,
            description,
            linkedType: 'wallet_tx',
            linkedId: tx.id,
            customerId,
            customerName: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`
              .trim()
              || null,
          },
          mgr,
        );
      } else {
        // points reward
        const points = Math.floor(amount);
        const newBalance = Number(customer.points) + points;
        customer.points = newBalance;
        await mgr.getRepository(CustomerEntity).save(customer);

        await mgr.getRepository(PointsTransactionEntity).save(
          mgr.getRepository(PointsTransactionEntity).create({
            customerId,
            type: PointsTransactionType.EARNED,
            points,
            balance: newBalance,
            description,
          }),
        );
      }
    });
  }

  // ─── Admin endpoints ────────────────────────────────────────────────

  async list(
    businessId: string,
    filter: ReferralFilterDto,
  ): Promise<PaginatedResponseDto<ReferralResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.referralRepo
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filter.status) qb.andWhere('r.status = :s', { s: filter.status });
    if (filter.referrerCustomerId)
      qb.andWhere('r.referrerCustomerId = :rid', {
        rid: filter.referrerCustomerId,
      });
    if (filter.dateFrom) qb.andWhere('r.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo)
      qb.andWhere('r.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });
    if (filter.search) {
      qb.andWhere('r.referralCode ILIKE :q', { q: `%${filter.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    const customerInfo = await this.fetchCustomerInfo(businessId, data);
    return paginate(data, total, page, limit, (r) =>
      ReferralResponseDto.from(r, customerInfo.get(r.id) ?? {}),
    );
  }

  async findOne(
    businessId: string,
    id: string,
  ): Promise<ReferralResponseDto> {
    const r = await this.referralRepo.findOne({ where: { id, businessId } });
    if (!r) throw new NotFoundException('Referral not found');
    const info = await this.fetchCustomerInfo(businessId, [r]);
    return ReferralResponseDto.from(r, info.get(r.id) ?? {});
  }

  async getStats(businessId: string): Promise<ReferralStatsDto> {
    const counts = await this.referralRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.referrerReward + r.referredReward), 0)', 'sum')
      .where('r.businessId = :businessId', { businessId })
      .groupBy('r.status')
      .getRawMany<{ status: ReferralStatus; count: string; sum: string }>();

    let totalReferrals = 0;
    let pending = 0;
    let signedUp = 0;
    let rewarded = 0;
    let expired = 0;
    let totalRewardsPaid = 0;
    let totalPendingRewards = 0;

    for (const r of counts) {
      const c = Number(r.count);
      const s = Number(r.sum);
      totalReferrals += c;
      if (r.status === 'pending') {
        pending += c;
        totalPendingRewards += s;
      } else if (r.status === 'signed_up') {
        signedUp += c;
        totalPendingRewards += s;
      } else if (r.status === 'first_purchase') {
        signedUp += c;
        totalPendingRewards += s;
      } else if (r.status === 'rewarded') {
        rewarded += c;
        totalRewardsPaid += s;
      } else if (r.status === 'expired') {
        expired += c;
      }
    }

    return {
      totalReferrals,
      pending,
      signedUp,
      rewarded,
      expired,
      totalRewardsPaid,
      totalPendingRewards,
    };
  }

  // ─── Storefront endpoint ────────────────────────────────────────────

  /** Returns the authenticated user's referral code + their referral history. */
  async mySummary(
    businessId: string,
    customerId: string,
  ): Promise<MyReferralsSummaryDto> {
    const me = await this.customerRepo.findOne({
      where: { id: customerId, businessId },
    });
    if (!me) throw new NotFoundException('Customer not found');
    const settings = await this.getOrCreateSettings(businessId);

    const referrals = await this.referralRepo.find({
      where: { businessId, referrerCustomerId: customerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const customerInfo = await this.fetchCustomerInfo(businessId, referrals);

    const rewarded = referrals.filter((r) => r.status === 'rewarded');
    const pending = referrals.filter(
      (r) => r.status === 'signed_up' || r.status === 'first_purchase',
    );

    return {
      referralCode: me.referralCode,
      totalReferred: referrals.length,
      rewardedCount: rewarded.length,
      pendingCount: pending.length,
      totalRewardEarned: rewarded.reduce(
        (sum, r) => sum + Number(r.referrerReward),
        0,
      ),
      totalRewardPending: pending.reduce(
        (sum, r) => sum + Number(r.referrerReward),
        0,
      ),
      rewardType: settings.rewardType,
      referrals: referrals.map((r) =>
        ReferralResponseDto.from(r, customerInfo.get(r.id) ?? {}),
      ),
    };
  }

  // ─── helpers ────────────────────────────────────────────────────────

  private async fetchCustomerInfo(
    businessId: string,
    referrals: ReferralEntity[],
  ): Promise<
    Map<
      string,
      {
        referrerName: string | null;
        referredName: string | null;
        referredEmail: string | null;
        referredPhone: string | null;
      }
    >
  > {
    const customerIds = new Set<string>();
    for (const r of referrals) {
      customerIds.add(r.referrerCustomerId);
      customerIds.add(r.referredCustomerId);
    }
    if (customerIds.size === 0) return new Map();
    const customers = await this.customerRepo.find({
      where: { id: In([...customerIds]), businessId },
      select: ['id', 'firstName', 'lastName', 'email', 'phone'],
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    const result = new Map<
      string,
      {
        referrerName: string | null;
        referredName: string | null;
        referredEmail: string | null;
        referredPhone: string | null;
      }
    >();
    for (const r of referrals) {
      const referrer = byId.get(r.referrerCustomerId);
      const referred = byId.get(r.referredCustomerId);
      result.set(r.id, {
        referrerName: referrer
          ? `${referrer.firstName} ${referrer.lastName}`.trim()
          : null,
        referredName: referred
          ? `${referred.firstName} ${referred.lastName}`.trim()
          : null,
        referredEmail: referred?.email ?? null,
        referredPhone: referred?.phone ?? null,
      });
    }
    return result;
  }
}
