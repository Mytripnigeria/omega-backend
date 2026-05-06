import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { CustomerEntity, LoyaltyTier } from './entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
  WalletTransactionEntity,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';
import { UserEntity } from '../users/entities/user.entity';
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
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
    private readonly ledger: FinancialTransactionsService,
  ) {}

  private generateReferralCode(): string {
    return `REF-${randomBytes(4).toString('hex').toUpperCase()}`;
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

    const userIds = await this.userRepo.find({
      where: data.map((d) => ({ customerId: d.id })),
      select: ['customerId'],
    });
    const haveUser = new Set(userIds.map((u) => u.customerId));

    return paginate(data, total, page, limit, (e) =>
      CustomerResponseDto.from(e, { hasUserAccount: haveUser.has(e.id) }),
    );
  }

  async findOne(businessId: string, id: string): Promise<CustomerResponseDto> {
    const customer = await this.findEntity(businessId, id);
    const user = await this.userRepo.findOne({ where: { customerId: id } });
    return CustomerResponseDto.from(customer, { hasUserAccount: !!user });
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

    return CustomerResponseDto.from(saved, { hasUserAccount: false });
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
    return CustomerResponseDto.from(saved, { hasUserAccount: !!user });
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
