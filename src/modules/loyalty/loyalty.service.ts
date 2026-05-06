import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyTierEntity } from './entities/loyalty-tier.entity';
import { LoyaltySettingsEntity } from './entities/loyalty-settings.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  PointsTransactionEntity,
  PointsTransactionType,
} from '../customers/entities/wallet-transaction.entity';
import {
  CreateLoyaltyTierDto,
  LoyaltySettingsResponseDto,
  LoyaltyStatsDto,
  LoyaltyTierFilterDto,
  LoyaltyTierResponseDto,
  UpdateLoyaltySettingsDto,
  UpdateLoyaltyTierDto,
} from './dto/loyalty.dto';
import {
  PaginatedResponseDto,
  paginate,
} from '../../common/dto/pagination.dto';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyTierEntity)
    private readonly tierRepo: Repository<LoyaltyTierEntity>,
    @InjectRepository(LoyaltySettingsEntity)
    private readonly settingsRepo: Repository<LoyaltySettingsEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(PointsTransactionEntity)
    private readonly pointsTxRepo: Repository<PointsTransactionEntity>,
  ) {}

  // ─── Tiers ──────────────────────────────────────────────────────────

  async listTiers(
    businessId: string,
    filter: LoyaltyTierFilterDto,
  ): Promise<PaginatedResponseDto<LoyaltyTierResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.tierRepo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId })
      .orderBy('t.minPoints', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filter.isActive !== undefined)
      qb.andWhere('t.isActive = :a', { a: filter.isActive });
    if (filter.search)
      qb.andWhere('(t.name ILIKE :q OR t.description ILIKE :q)', {
        q: `%${filter.search}%`,
      });

    const [tiers, total] = await qb.getManyAndCount();
    const counts = await this.computeMemberCounts(businessId, tiers);
    return paginate(tiers, total, page, limit, (t) =>
      LoyaltyTierResponseDto.from(t, counts.get(t.id) ?? 0),
    );
  }

  async findTier(
    businessId: string,
    id: string,
  ): Promise<LoyaltyTierResponseDto> {
    const tier = await this.findEntity(businessId, id);
    const counts = await this.computeMemberCounts(businessId, [tier]);
    return LoyaltyTierResponseDto.from(tier, counts.get(tier.id) ?? 0);
  }

  async createTier(
    businessId: string,
    dto: CreateLoyaltyTierDto,
  ): Promise<LoyaltyTierResponseDto> {
    const dup = await this.tierRepo.findOne({
      where: { businessId, name: dto.name },
    });
    if (dup) throw new ConflictException(`Tier "${dto.name}" already exists`);

    const tier = this.tierRepo.create({
      ...dto,
      businessId,
      benefits: dto.benefits ?? [],
      isActive: dto.isActive ?? true,
    });
    const saved = await this.tierRepo.save(tier);
    return LoyaltyTierResponseDto.from(saved, 0);
  }

  async updateTier(
    businessId: string,
    id: string,
    dto: UpdateLoyaltyTierDto,
  ): Promise<LoyaltyTierResponseDto> {
    const tier = await this.findEntity(businessId, id);
    if (dto.name && dto.name !== tier.name) {
      const dup = await this.tierRepo.findOne({
        where: { businessId, name: dto.name },
      });
      if (dup) throw new ConflictException(`Tier "${dto.name}" already exists`);
    }
    Object.assign(tier, dto);
    if (dto.benefits) tier.benefits = dto.benefits;
    const saved = await this.tierRepo.save(tier);
    const counts = await this.computeMemberCounts(businessId, [saved]);
    return LoyaltyTierResponseDto.from(saved, counts.get(saved.id) ?? 0);
  }

  async removeTier(businessId: string, id: string): Promise<void> {
    const tier = await this.findEntity(businessId, id);
    await this.tierRepo.softRemove(tier);
  }

  /** Resolve the tier a customer's points balance places them in. */
  async resolveTierForPoints(
    businessId: string,
    points: number,
  ): Promise<LoyaltyTierEntity | null> {
    return this.tierRepo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId })
      .andWhere('t.isActive = TRUE')
      .andWhere('t.minPoints <= :points', { points })
      .orderBy('t.minPoints', 'DESC')
      .getOne();
  }

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<LoyaltyTierEntity> {
    const tier = await this.tierRepo.findOne({ where: { id, businessId } });
    if (!tier) throw new NotFoundException('Loyalty tier not found');
    return tier;
  }

  /**
   * Count how many customers are currently in each tier — based on the
   * minPoints staircase (a customer is in the highest tier whose minPoints
   * threshold they meet).
   */
  private async computeMemberCounts(
    businessId: string,
    tiers: LoyaltyTierEntity[],
  ): Promise<Map<string, number>> {
    if (tiers.length === 0) return new Map();
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    const counts = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const next = sorted[i + 1];
      const qb = this.customerRepo
        .createQueryBuilder('c')
        .where('c.businessId = :businessId', { businessId })
        .andWhere('c.points >= :min', { min: t.minPoints });
      if (next) qb.andWhere('c.points < :nextMin', { nextMin: next.minPoints });
      counts.set(t.id, await qb.getCount());
    }
    return counts;
  }

  // ─── Settings (lazy-create per business) ────────────────────────────

  async getSettings(businessId: string): Promise<LoyaltySettingsResponseDto> {
    const settings = await this.getOrCreateSettings(businessId);
    return LoyaltySettingsResponseDto.from(settings);
  }

  async updateSettings(
    businessId: string,
    dto: UpdateLoyaltySettingsDto,
  ): Promise<LoyaltySettingsResponseDto> {
    const settings = await this.getOrCreateSettings(businessId);
    Object.assign(settings, dto);
    const saved = await this.settingsRepo.save(settings);
    return LoyaltySettingsResponseDto.from(saved);
  }

  private async getOrCreateSettings(
    businessId: string,
  ): Promise<LoyaltySettingsEntity> {
    let settings = await this.settingsRepo.findOne({ where: { businessId } });
    if (!settings) {
      settings = this.settingsRepo.create({ businessId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  async getStats(businessId: string): Promise<LoyaltyStatsDto> {
    const memberRow = await this.customerRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(c.points), 0)', 'balance')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('c.points > 0')
      .getRawOne<{ total: string; balance: string }>();

    const issuedRow = await this.pointsTxRepo
      .createQueryBuilder('p')
      .innerJoin(CustomerEntity, 'c', 'c.id = p.customerId')
      .select('COALESCE(SUM(p.points), 0)', 'total')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('p.type = :t', { t: PointsTransactionType.EARNED })
      .getRawOne<{ total: string }>();

    const redeemedRow = await this.pointsTxRepo
      .createQueryBuilder('p')
      .innerJoin(CustomerEntity, 'c', 'c.id = p.customerId')
      .select('COALESCE(SUM(ABS(p.points)), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('p.type = :t', { t: PointsTransactionType.REDEEMED })
      .getRawOne<{ total: string; count: string }>();

    return {
      totalMembers: Number(memberRow?.total ?? 0),
      totalPointsBalance: Number(memberRow?.balance ?? 0),
      totalPointsIssued: Number(issuedRow?.total ?? 0),
      totalPointsRedeemed: Number(redeemedRow?.total ?? 0),
      rewardsRedeemed: Number(redeemedRow?.count ?? 0),
    };
  }
}
