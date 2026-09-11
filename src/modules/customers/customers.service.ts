import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  CustomerEntity,
  CustomerSource,
  LoyaltyTier,
} from './entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoyaltyTierEntity } from '../loyalty/entities/loyalty-tier.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerFilterDto } from './dto/customer-filter.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import {
  PointsTransactionResponseDto,
  WalletTransactionResponseDto,
} from './dto/wallet-response.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { FinancialTransactionsService } from '../financial-transactions/financial-transactions.service';

interface CustomerActor {
  sub: string;
  email?: string;
  businessId: string;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(WalletTransactionEntity)
    private readonly walletRepo: Repository<WalletTransactionEntity>,
    @InjectRepository(PointsTransactionEntity)
    private readonly pointsRepo: Repository<PointsTransactionEntity>,
    @InjectRepository(LoyaltyTierEntity)
    private readonly loyaltyTierRepo: Repository<LoyaltyTierEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly ledger: FinancialTransactionsService,
  ) {}

  private generateReferralCode(): string {
    return `REF-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  /** Picks the highest-threshold active tier the customer's points cover.
   *  Returns null when no tiers are configured or none match (legacy enum
   *  remains the fallback). */
  private async resolveTier(
    businessId: string,
    points: number,
  ): Promise<LoyaltyTierEntity | null> {
    return this.loyaltyTierRepo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId })
      .andWhere('t.isActive = TRUE')
      .andWhere('t.minPoints <= :points', { points })
      .orderBy('t.minPoints', 'DESC')
      .getOne();
  }

  /** Resolves tier for each customer in a list using a single batch query. */
  private async resolveTiersForList(
    businessId: string,
    customers: CustomerEntity[],
  ): Promise<Map<string, LoyaltyTierEntity>> {
    const tiers = await this.loyaltyTierRepo.find({
      where: { businessId, isActive: true },
      order: { minPoints: 'DESC' },
    });
    const byCustomer = new Map<string, LoyaltyTierEntity>();
    if (tiers.length === 0) return byCustomer;
    for (const c of customers) {
      const matched = tiers.find((t) => Number(t.minPoints) <= Number(c.points));
      if (matched) byCustomer.set(c.id, matched);
    }
    return byCustomer;
  }

  async findAll(
    businessId: string,
    filter: CustomerFilterDto,
  ): Promise<PaginatedResponseDto<CustomerResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC');

    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (filter.source) qb.andWhere('c.source = :source', { source: filter.source });
    if (filter.loyaltyTier)
      qb.andWhere('c.loyaltyTier = :tier', { tier: filter.loyaltyTier });
    if (filter.group)
      qb.andWhere('c.groups LIKE :group', { group: `%${filter.group}%` });
    if (filter.search) {
      qb.andWhere(
        '(c.firstName ILIKE :s OR c.lastName ILIKE :s OR c.email ILIKE :s OR c.phone ILIKE :s)',
        { s: `%${filter.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    const userIds =
      data.length > 0
        ? await this.userRepo.find({
            where: data.map((d) => ({ customerId: d.id })),
            select: ['customerId'],
          })
        : [];
    const haveUser = new Set(userIds.map((u) => u.customerId));
    const tierByCustomer = await this.resolveTiersForList(businessId, data);

    return paginate(data, total, page, limit, (e) => {
      const tier = tierByCustomer.get(e.id);
      return CustomerResponseDto.from(e, {
        hasUserAccount: haveUser.has(e.id),
        loyaltyTierId: tier?.id ?? null,
        loyaltyTierName: tier?.name ?? null,
      });
    });
  }

  async findOne(businessId: string, id: string): Promise<CustomerResponseDto> {
    const customer = await this.findEntity(businessId, id);
    const user = await this.userRepo.findOne({ where: { customerId: id } });
    const tier = await this.resolveTier(businessId, Number(customer.points));
    return CustomerResponseDto.from(customer, {
      hasUserAccount: !!user,
      loyaltyTierId: tier?.id ?? null,
      loyaltyTierName: tier?.name ?? null,
    });
  }

  private async findEntity(businessId: string, id: string): Promise<CustomerEntity> {
    const customer = await this.customerRepo.findOne({
      where: { id, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(
    actor: CustomerActor,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    if (dto.email) {
      const existing = await this.customerRepo.findOne({
        where: { businessId: actor.businessId, email: dto.email },
      });
      if (existing)
        throw new ConflictException(
          'A customer with this email already exists',
        );
    }
    if (dto.phone) {
      const existing = await this.customerRepo.findOne({
        where: { businessId: actor.businessId, phone: dto.phone },
      });
      if (existing)
        throw new ConflictException(
          'A customer with this phone already exists',
        );
    }

    const customer = this.customerRepo.create({
      ...dto,
      businessId: actor.businessId,
      referralCode: this.generateReferralCode(),
      groups: dto.groups ?? [],
    });
    const saved = await this.customerRepo.save(customer);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'customer.created',
      businessId: actor.businessId,
      resourceType: 'customer',
      resourceId: saved.id,
      metadata: { email: saved.email, phone: saved.phone },
    });

    const tier = await this.resolveTier(actor.businessId, Number(saved.points));
    return CustomerResponseDto.from(saved, {
      hasUserAccount: false,
      loyaltyTierId: tier?.id ?? null,
      loyaltyTierName: tier?.name ?? null,
    });
  }

  async update(
    actor: CustomerActor,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.findEntity(actor.businessId, id);
    Object.assign(customer, dto);
    const saved = await this.customerRepo.save(customer);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'customer.updated',
      businessId: actor.businessId,
      resourceType: 'customer',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });

    const user = await this.userRepo.findOne({ where: { customerId: id } });
    const tier = await this.resolveTier(actor.businessId, Number(saved.points));
    return CustomerResponseDto.from(saved, {
      hasUserAccount: !!user,
      loyaltyTierId: tier?.id ?? null,
      loyaltyTierName: tier?.name ?? null,
    });
  }

  async remove(actor: CustomerActor, id: string): Promise<void> {
    const customer = await this.findEntity(actor.businessId, id);
    await this.customerRepo.softRemove(customer);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'customer.deleted',
      businessId: actor.businessId,
      resourceType: 'customer',
      resourceId: id,
    });
  }

  async getStats(businessId: string) {
    const total = await this.customerRepo.count({ where: { businessId } });
    const active = await this.customerRepo.count({
      where: { businessId, status: 'active' as never },
    });
    const vip = await this.customerRepo.count({
      where: { businessId, status: 'vip' as never },
    });

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const newThisMonth = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('c.createdAt >= :since', { since: monthAgo })
      .getCount();

    const wallet = await this.customerRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.walletBalance), 0)', 'total')
      .where('c.businessId = :businessId', { businessId })
      .getRawOne<{ total: string }>();
    const points = await this.customerRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.points), 0)', 'total')
      .where('c.businessId = :businessId', { businessId })
      .getRawOne<{ total: string }>();

    return {
      total,
      active,
      vip,
      newThisMonth,
      totalWalletBalance: Number(wallet?.total ?? 0),
      totalPoints: Number(points?.total ?? 0),
    };
  }

  // ---------- Wallet ----------

  async creditWallet(
    actor: CustomerActor,
    customerId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<WalletTransactionResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const customer = await mgr.getRepository(CustomerEntity).findOne({
        where: { id: customerId, businessId: actor.businessId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      const newBalance = Number(customer.walletBalance) + amount;
      customer.walletBalance = newBalance;
      await mgr.getRepository(CustomerEntity).save(customer);

      const tx = mgr.getRepository(WalletTransactionEntity).create({
        customerId,
        type: WalletTransactionType.CREDIT,
        amount,
        balance: newBalance,
        description,
        reference: reference ?? null,
      });
      const saved = await mgr.getRepository(WalletTransactionEntity).save(tx);

      await this.ledger.record(
        {
          businessId: actor.businessId,
          type: 'credit',
          purpose: 'wallet_credit',
          amount,
          method: 'wallet',
          reference: reference ?? null,
          description: description || `Wallet credit ${customer.firstName ?? ''}`.trim(),
          linkedType: 'wallet_tx',
          linkedId: saved.id,
          customerId,
          customerName: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || null,
          staffId: actor.sub,
          staffName: actor.email ?? null,
        },
        mgr,
      );

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email ?? 'Admin',
        action: 'customer.wallet_credited',
        businessId: actor.businessId,
        resourceType: 'customer',
        resourceId: customerId,
        metadata: { amount, balance: newBalance },
      });

      return WalletTransactionResponseDto.from(saved);
    });
  }

  async debitWallet(
    actor: CustomerActor,
    customerId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<WalletTransactionResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const customer = await mgr.getRepository(CustomerEntity).findOne({
        where: { id: customerId, businessId: actor.businessId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      if (Number(customer.walletBalance) < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newBalance = Number(customer.walletBalance) - amount;
      customer.walletBalance = newBalance;
      await mgr.getRepository(CustomerEntity).save(customer);

      const tx = mgr.getRepository(WalletTransactionEntity).create({
        customerId,
        type: WalletTransactionType.DEBIT,
        amount,
        balance: newBalance,
        description,
        reference: reference ?? null,
      });
      const saved = await mgr.getRepository(WalletTransactionEntity).save(tx);

      await this.ledger.record(
        {
          businessId: actor.businessId,
          type: 'debit',
          purpose: 'wallet_debit',
          amount,
          method: 'wallet',
          reference: reference ?? null,
          description: description || `Wallet debit ${customer.firstName ?? ''}`.trim(),
          linkedType: 'wallet_tx',
          linkedId: saved.id,
          customerId,
          customerName: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || null,
          staffId: actor.sub,
          staffName: actor.email ?? null,
        },
        mgr,
      );

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email ?? 'Admin',
        action: 'customer.wallet_debited',
        businessId: actor.businessId,
        resourceType: 'customer',
        resourceId: customerId,
        metadata: { amount, balance: newBalance, reference },
      });

      return WalletTransactionResponseDto.from(saved);
    });
  }

  async getWalletTransactions(
    businessId: string,
    customerId: string,
  ): Promise<WalletTransactionResponseDto[]> {
    await this.findEntity(businessId, customerId);
    const txs = await this.walletRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return txs.map((t) => WalletTransactionResponseDto.from(t));
  }

  // ---------- Points ----------

  async addPoints(
    actor: CustomerActor,
    customerId: string,
    points: number,
    description: string,
    orderId?: string,
  ): Promise<PointsTransactionResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const customer = await mgr.getRepository(CustomerEntity).findOne({
        where: { id: customerId, businessId: actor.businessId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      const newBalance = customer.points + points;
      customer.points = newBalance;
      customer.loyaltyTier = this.tierFor(newBalance);
      await mgr.getRepository(CustomerEntity).save(customer);

      const tx = mgr.getRepository(PointsTransactionEntity).create({
        customerId,
        type: PointsTransactionType.EARNED,
        points,
        balance: newBalance,
        description,
        orderId: orderId ?? null,
      });
      const saved = await mgr.getRepository(PointsTransactionEntity).save(tx);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email ?? 'Admin',
        action: 'customer.points_added',
        businessId: actor.businessId,
        resourceType: 'customer',
        resourceId: customerId,
        metadata: { points, balance: newBalance },
      });

      return PointsTransactionResponseDto.from(saved);
    });
  }

  async redeemPoints(
    actor: CustomerActor,
    customerId: string,
    points: number,
    description: string,
  ): Promise<PointsTransactionResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const customer = await mgr.getRepository(CustomerEntity).findOne({
        where: { id: customerId, businessId: actor.businessId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      if (customer.points < points) {
        throw new BadRequestException('Insufficient points');
      }

      const newBalance = customer.points - points;
      customer.points = newBalance;
      customer.loyaltyTier = this.tierFor(newBalance);
      await mgr.getRepository(CustomerEntity).save(customer);

      const tx = mgr.getRepository(PointsTransactionEntity).create({
        customerId,
        type: PointsTransactionType.REDEEMED,
        points: -points,
        balance: newBalance,
        description,
      });
      const saved = await mgr.getRepository(PointsTransactionEntity).save(tx);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email ?? 'Admin',
        action: 'customer.points_redeemed',
        businessId: actor.businessId,
        resourceType: 'customer',
        resourceId: customerId,
        metadata: { points, balance: newBalance },
      });

      return PointsTransactionResponseDto.from(saved);
    });
  }

  async getPointsTransactions(
    businessId: string,
    customerId: string,
  ): Promise<PointsTransactionResponseDto[]> {
    await this.findEntity(businessId, customerId);
    const txs = await this.pointsRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return txs.map((t) => PointsTransactionResponseDto.from(t));
  }

  private tierFor(points: number): LoyaltyTier {
    if (points >= 10000) return LoyaltyTier.PLATINUM;
    if (points >= 5000) return LoyaltyTier.GOLD;
    if (points >= 1000) return LoyaltyTier.SILVER;
    return LoyaltyTier.BRONZE;
  }

  // ---------- Internal helpers ----------

  /**
   * Look up customer by email or phone. Returns null if no match.
   * Used by storefront register flow to link existing customer records.
   */
  async findByEmailOrPhone(
    businessId: string,
    email?: string,
    phone?: string,
  ): Promise<CustomerEntity | null> {
    if (!email && !phone) return null;
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId });
    if (email && phone) {
      qb.andWhere('(c.email = :email OR c.phone = :phone)', { email, phone });
    } else if (email) {
      qb.andWhere('c.email = :email', { email });
    } else if (phone) {
      qb.andWhere('c.phone = :phone', { phone });
    }
    return qb.getOne();
  }

  /**
   * Update denormalised order aggregates. Called from orders service when an order
   * is created/cancelled.
   */
  async recordOrder(
    customerId: string,
    delta: { ordersDelta: number; spentDelta: number; orderAt?: Date | null },
  ): Promise<void> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) return;
    customer.totalOrders = Math.max(0, customer.totalOrders + delta.ordersDelta);
    customer.totalSpent = Math.max(
      0,
      Number(customer.totalSpent) + delta.spentDelta,
    );
    if (delta.orderAt) customer.lastOrderAt = delta.orderAt;
    await this.customerRepo.save(customer);
  }

  /**
   * Find-or-create the customer behind a marketplace order.
   *
   * Chowdeck and Cloove send a name and (usually) a phone/email but no id of
   * ours, so without this an order's customer existed only as two loose text
   * columns on the order row — never reaching the customers list, and never
   * accumulating order counts or spend. Matching is by phone/email because
   * that is what the marketplaces reliably supply; a returning customer is
   * therefore recognised across channels instead of being duplicated.
   *
   * Returns `null` when there is nothing to match or create on (no phone and
   * no email) rather than inventing an unreachable contact.
   */
  async findOrCreateFromChannel(
    businessId: string,
    input: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      source: CustomerSource;
    },
  ): Promise<CustomerEntity | null> {
    const email = input.email?.trim() || undefined;
    const phone = input.phone?.trim() || undefined;
    if (!email && !phone) return null;

    const existing = await this.findByEmailOrPhone(businessId, email, phone);
    if (existing) {
      // Backfill whichever contact detail we did not have before — a customer
      // first seen by phone gains their email the next time one arrives.
      let touched = false;
      if (email && !existing.email) {
        existing.email = email;
        touched = true;
      }
      if (phone && !existing.phone) {
        existing.phone = phone;
        touched = true;
      }
      if (touched) await this.customerRepo.save(existing);
      return existing;
    }

    const parts = (input.name ?? '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Guest';
    const lastName = parts.slice(1).join(' ') || '-';

    try {
      return await this.createInternal(businessId, {
        firstName,
        lastName,
        email,
        phone,
        source: input.source as never,
      });
    } catch {
      // Raced with a concurrent ingest of the same customer (the unique index
      // on businessId+phone/email caught it) — take whichever row won.
      return this.findByEmailOrPhone(businessId, email, phone);
    }
  }

  async createInternal(
    businessId: string,
    dto: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      source: CreateCustomerDto['source'];
    },
  ): Promise<CustomerEntity> {
    const customer = this.customerRepo.create({
      businessId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      source: dto.source as never,
      groups: [],
      referralCode: this.generateReferralCode(),
    });
    return this.customerRepo.save(customer);
  }
}
