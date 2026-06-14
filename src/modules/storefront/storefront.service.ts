import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  StorefrontConfigEntity,
  StoreStatus,
} from './entities/storefront-config.entity';
import {
  PageStatus,
  StorefrontPageEntity,
} from './entities/storefront-page.entity';
import { StorefrontBannerEntity } from './entities/storefront-banner.entity';
import { StorefrontThemePresetEntity } from './entities/storefront-theme-preset.entity';
import { StorefrontPageViewEntity } from './entities/storefront-page-view.entity';
import { PaymentMethodEntity } from '../payment-methods/entities/payment-method.entity';
import { UpdateStorefrontConfigDto } from './dto/config.dto';
import {
  CreateStorefrontPageDto,
  ReorderDto,
  StorefrontPageFilterDto,
  StorefrontPageResponseDto,
  UpdateStorefrontPageDto,
} from './dto/page.dto';
import {
  CreateStorefrontBannerDto,
  StorefrontBannerFilterDto,
  StorefrontBannerResponseDto,
  UpdateStorefrontBannerDto,
} from './dto/banner.dto';
import { StorefrontConfigResponseDto } from './dto/config.dto';
import {
  CreateThemePresetDto,
  ThemePresetResponseDto,
} from './dto/theme.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { BusinessService } from '../business/business.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';

const SYSTEM_PRESETS: Array<
  Omit<StorefrontThemePresetEntity, 'id' | 'createdAt' | 'updatedAt'>
> = [
  {
    businessId: null,
    name: 'Modern Light',
    description: 'Clean and professional',
    primaryColor: '#3B82F6',
    secondaryColor: '#1F2937',
    accentColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    foregroundColor: '#0F172A',
    fontFamily: 'Inter',
    isSystem: true,
  },
  {
    businessId: null,
    name: 'Dark Elegant',
    description: 'Sophisticated dark mode',
    primaryColor: '#8B5CF6',
    secondaryColor: '#374151',
    accentColor: '#F472B6',
    backgroundColor: '#1F2937',
    foregroundColor: '#F9FAFB',
    fontFamily: 'Inter',
    isSystem: true,
  },
  {
    businessId: null,
    name: 'Warm Sunset',
    description: 'Warm and inviting',
    primaryColor: '#F59E0B',
    secondaryColor: '#FCD34D',
    accentColor: '#EF4444',
    backgroundColor: '#FEF3C7',
    foregroundColor: '#451A03',
    fontFamily: 'Inter',
    isSystem: true,
  },
  {
    businessId: null,
    name: 'Fresh Green',
    description: 'Natural and organic',
    primaryColor: '#10B981',
    secondaryColor: '#6EE7B7',
    accentColor: '#14B8A6',
    backgroundColor: '#ECFDF5',
    foregroundColor: '#064E3B',
    fontFamily: 'Inter',
    isSystem: true,
  },
];

@Injectable()
export class StorefrontService implements OnModuleInit {
  constructor(
    @InjectRepository(StorefrontConfigEntity)
    private readonly configRepo: Repository<StorefrontConfigEntity>,
    @InjectRepository(StorefrontPageEntity)
    private readonly pageRepo: Repository<StorefrontPageEntity>,
    @InjectRepository(StorefrontBannerEntity)
    private readonly bannerRepo: Repository<StorefrontBannerEntity>,
    @InjectRepository(StorefrontThemePresetEntity)
    private readonly themeRepo: Repository<StorefrontThemePresetEntity>,
    @InjectRepository(StorefrontPageViewEntity)
    private readonly viewRepo: Repository<StorefrontPageViewEntity>,
    @InjectRepository(PaymentMethodEntity)
    private readonly paymentMethodRepo: Repository<PaymentMethodEntity>,
    private readonly activityLog: ActivityLogService,
    private readonly business: BusinessService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed system theme presets if not present
    for (const preset of SYSTEM_PRESETS) {
      const exists = await this.themeRepo.findOne({
        where: { businessId: IsNull(), name: preset.name },
      });
      if (!exists) {
        await this.themeRepo.save(this.themeRepo.create(preset));
      }
    }
  }

  // ---------- Config ----------

  async getConfig(businessId: string): Promise<StorefrontConfigResponseDto> {
    return this.composeConfig(await this.getConfigEntity(businessId), businessId);
  }

  /**
   * Resolves the per-business pricing knobs (VAT, points-per-naira, naira-per-point)
   * from BusinessSettings + LoyaltySettings and decorates the storefront config so
   * the public storefront and admin both render consistent totals.
   */
  private async composeConfig(
    entity: StorefrontConfigEntity,
    businessId: string,
  ): Promise<StorefrontConfigResponseDto> {
    const [biz, loyalty] = await Promise.all([
      this.business.getSettings(businessId).catch(() => null),
      this.loyalty.getSettings(businessId).catch(() => null),
    ]);
    return StorefrontConfigResponseDto.from(entity, {
      taxRate: biz?.taxRate ?? 0.075,
      pointsPerNaira: loyalty?.pointsPerNaira ?? 0.1,
      nairaPerPoint: loyalty?.nairaPerPoint ?? 0.1,
    });
  }

  private async getConfigEntity(
    businessId: string,
  ): Promise<StorefrontConfigEntity> {
    let cfg = await this.configRepo.findOne({ where: { businessId } });
    if (!cfg) {
      cfg = this.configRepo.create({ businessId });
      cfg = await this.configRepo.save(cfg);
    }
    return cfg;
  }

  async updateConfig(
    actor: AdminJwtPayload,
    dto: UpdateStorefrontConfigDto,
  ): Promise<StorefrontConfigResponseDto> {
    const cfg = await this.getConfigEntity(actor.businessId);

    // If activeThemeId is set, copy palette/font from the preset.
    if (dto.activeThemeId) {
      const preset = await this.themeRepo.findOne({
        where: { id: dto.activeThemeId },
      });
      if (!preset) throw new NotFoundException('Theme preset not found');
      if (preset.businessId && preset.businessId !== actor.businessId) {
        throw new BadRequestException('Theme preset belongs to another business');
      }
      cfg.primaryColor = preset.primaryColor;
      cfg.secondaryColor = preset.secondaryColor;
      cfg.accentColor = preset.accentColor;
      cfg.backgroundColor = preset.backgroundColor;
      cfg.foregroundColor = preset.foregroundColor;
      cfg.fontFamily = preset.fontFamily;
    }

    Object.assign(cfg, dto);
    const saved = await this.configRepo.save(cfg);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.config_updated',
      businessId: actor.businessId,
      resourceType: 'storefront_config',
      resourceId: actor.businessId,
      metadata: { fields: Object.keys(dto) },
    });

    return this.composeConfig(saved, actor.businessId);
  }

  // ---------- Themes ----------

  async listThemes(businessId: string): Promise<ThemePresetResponseDto[]> {
    const presets = await this.themeRepo.find({
      where: [{ businessId: IsNull() }, { businessId }],
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    return presets.map(ThemePresetResponseDto.from);
  }

  async createTheme(
    actor: AdminJwtPayload,
    dto: CreateThemePresetDto,
  ): Promise<ThemePresetResponseDto> {
    const preset = this.themeRepo.create({
      ...dto,
      businessId: actor.businessId,
      fontFamily: dto.fontFamily ?? 'Inter',
      isSystem: false,
    });
    const saved = await this.themeRepo.save(preset);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.theme_created',
      businessId: actor.businessId,
      resourceType: 'storefront_theme',
      resourceId: saved.id,
      metadata: { name: saved.name },
    });

    return ThemePresetResponseDto.from(saved);
  }

  async deleteTheme(actor: AdminJwtPayload, id: string): Promise<void> {
    const preset = await this.themeRepo.findOne({ where: { id } });
    if (!preset) throw new NotFoundException('Theme preset not found');
    if (preset.isSystem) {
      throw new BadRequestException('System theme presets cannot be deleted');
    }
    if (preset.businessId !== actor.businessId) {
      throw new BadRequestException('Cannot delete a preset from another business');
    }
    // If it's the active theme, clear it on the config first
    const cfg = await this.getConfigEntity(actor.businessId);
    if (cfg.activeThemeId === id) {
      cfg.activeThemeId = null;
      await this.configRepo.save(cfg);
    }
    await this.themeRepo.delete(id);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.theme_deleted',
      businessId: actor.businessId,
      resourceType: 'storefront_theme',
      resourceId: id,
    });
  }

  // ---------- Pages ----------

  async listPages(
    businessId: string,
    filter: StorefrontPageFilterDto,
  ): Promise<PaginatedResponseDto<StorefrontPageResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.pageRepo
      .createQueryBuilder('p')
      .where('p.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.position', 'ASC')
      .addOrderBy('p.createdAt', 'ASC');

    if (filter.status) qb.andWhere('p.status = :s', { s: filter.status });
    if (filter.template) qb.andWhere('p.template = :t', { t: filter.template });
    if (filter.search) {
      qb.andWhere('(p.name ILIKE :q OR p.slug ILIKE :q)', {
        q: `%${filter.search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, StorefrontPageResponseDto.from);
  }

  async getPage(
    businessId: string,
    id: string,
  ): Promise<StorefrontPageResponseDto> {
    return StorefrontPageResponseDto.from(await this.findPageEntity(businessId, id));
  }

  private async findPageEntity(
    businessId: string,
    id: string,
  ): Promise<StorefrontPageEntity> {
    const p = await this.pageRepo.findOne({ where: { id, businessId } });
    if (!p) throw new NotFoundException('Page not found');
    return p;
  }

  async createPage(
    actor: AdminJwtPayload,
    dto: CreateStorefrontPageDto,
  ): Promise<StorefrontPageResponseDto> {
    const existing = await this.pageRepo.findOne({
      where: { businessId: actor.businessId, slug: dto.slug },
    });
    if (existing) throw new ConflictException('A page with this slug already exists');

    const page = this.pageRepo.create({
      ...dto,
      businessId: actor.businessId,
      status: dto.status ?? PageStatus.DRAFT,
      position: dto.position ?? 0,
      publishedAt: dto.status === PageStatus.PUBLISHED ? new Date() : null,
    });
    const saved = await this.pageRepo.save(page);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.page_created',
      businessId: actor.businessId,
      resourceType: 'storefront_page',
      resourceId: saved.id,
      metadata: { name: saved.name, slug: saved.slug, status: saved.status },
    });

    return StorefrontPageResponseDto.from(saved);
  }

  async updatePage(
    actor: AdminJwtPayload,
    id: string,
    dto: UpdateStorefrontPageDto,
  ): Promise<StorefrontPageResponseDto> {
    const page = await this.findPageEntity(actor.businessId, id);

    if (dto.slug && dto.slug !== page.slug) {
      const conflict = await this.pageRepo.findOne({
        where: { businessId: actor.businessId, slug: dto.slug },
      });
      if (conflict) throw new ConflictException('Slug already in use');
    }

    const wasPublished = page.status === PageStatus.PUBLISHED;
    Object.assign(page, dto);
    if (
      dto.status === PageStatus.PUBLISHED &&
      !wasPublished &&
      !page.publishedAt
    ) {
      page.publishedAt = new Date();
    }
    const saved = await this.pageRepo.save(page);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.page_updated',
      businessId: actor.businessId,
      resourceType: 'storefront_page',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return StorefrontPageResponseDto.from(saved);
  }

  async deletePage(actor: AdminJwtPayload, id: string): Promise<void> {
    const page = await this.findPageEntity(actor.businessId, id);
    await this.pageRepo.softRemove(page);
    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.page_deleted',
      businessId: actor.businessId,
      resourceType: 'storefront_page',
      resourceId: id,
    });
  }

  async reorderPages(actor: AdminJwtPayload, dto: ReorderDto): Promise<void> {
    if (dto.items.length === 0) return;
    const ids = dto.items.map((i) => i.id);
    const pages = await this.pageRepo.find({
      where: { id: In(ids), businessId: actor.businessId },
    });
    if (pages.length !== ids.length) {
      throw new BadRequestException('Some pages do not belong to this business');
    }
    const map = new Map(dto.items.map((i) => [i.id, i.position]));
    for (const p of pages) {
      const next = map.get(p.id);
      if (next !== undefined) p.position = next;
    }
    await this.pageRepo.save(pages);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.pages_reordered',
      businessId: actor.businessId,
      resourceType: 'storefront_page',
      metadata: { count: ids.length },
    });
  }

  // ---------- Banners ----------

  async listBanners(
    businessId: string,
    filter: StorefrontBannerFilterDto,
  ): Promise<PaginatedResponseDto<StorefrontBannerResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.bannerRepo
      .createQueryBuilder('b')
      .where('b.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('b.position', 'ASC')
      .addOrderBy('b.createdAt', 'DESC');

    if (filter.isActive !== undefined)
      qb.andWhere('b.isActive = :a', { a: filter.isActive });
    if (filter.search)
      qb.andWhere('(b.title ILIKE :q OR b.description ILIKE :q)', {
        q: `%${filter.search}%`,
      });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, StorefrontBannerResponseDto.from);
  }

  async getBanner(
    businessId: string,
    id: string,
  ): Promise<StorefrontBannerResponseDto> {
    return StorefrontBannerResponseDto.from(
      await this.findBannerEntity(businessId, id),
    );
  }

  private async findBannerEntity(
    businessId: string,
    id: string,
  ): Promise<StorefrontBannerEntity> {
    const b = await this.bannerRepo.findOne({ where: { id, businessId } });
    if (!b) throw new NotFoundException('Banner not found');
    return b;
  }

  async createBanner(
    actor: AdminJwtPayload,
    dto: CreateStorefrontBannerDto,
  ): Promise<StorefrontBannerResponseDto> {
    const banner = this.bannerRepo.create({
      ...dto,
      businessId: actor.businessId,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
      position: dto.position ?? 0,
    });
    const saved = await this.bannerRepo.save(banner);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.banner_created',
      businessId: actor.businessId,
      resourceType: 'storefront_banner',
      resourceId: saved.id,
      metadata: { title: saved.title },
    });

    return StorefrontBannerResponseDto.from(saved);
  }

  async updateBanner(
    actor: AdminJwtPayload,
    id: string,
    dto: UpdateStorefrontBannerDto,
  ): Promise<StorefrontBannerResponseDto> {
    const banner = await this.findBannerEntity(actor.businessId, id);
    Object.assign(banner, dto);
    if (dto.startsAt !== undefined)
      banner.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      banner.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    const saved = await this.bannerRepo.save(banner);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.banner_updated',
      businessId: actor.businessId,
      resourceType: 'storefront_banner',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return StorefrontBannerResponseDto.from(saved);
  }

  async deleteBanner(actor: AdminJwtPayload, id: string): Promise<void> {
    const banner = await this.findBannerEntity(actor.businessId, id);
    await this.bannerRepo.softRemove(banner);
    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.banner_deleted',
      businessId: actor.businessId,
      resourceType: 'storefront_banner',
      resourceId: id,
    });
  }

  async reorderBanners(actor: AdminJwtPayload, dto: ReorderDto): Promise<void> {
    if (dto.items.length === 0) return;
    const ids = dto.items.map((i) => i.id);
    const banners = await this.bannerRepo.find({
      where: { id: In(ids), businessId: actor.businessId },
    });
    if (banners.length !== ids.length) {
      throw new BadRequestException('Some banners do not belong to this business');
    }
    const map = new Map(dto.items.map((i) => [i.id, i.position]));
    for (const b of banners) {
      const next = map.get(b.id);
      if (next !== undefined) b.position = next;
    }
    await this.bannerRepo.save(banners);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'storefront.banners_reordered',
      businessId: actor.businessId,
      resourceType: 'storefront_banner',
      metadata: { count: ids.length },
    });
  }

  // ---------- Stats ----------

  async getStats(businessId: string) {
    const totalPages = await this.pageRepo.count({ where: { businessId } });
    const publishedPages = await this.pageRepo.count({
      where: { businessId, status: PageStatus.PUBLISHED },
    });
    const totalBanners = await this.bannerRepo.count({ where: { businessId } });
    const activeBanners = await this.bannerRepo.count({
      where: { businessId, isActive: true },
    });
    const viewsRow = await this.pageRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.views), 0)', 'sum')
      .where('p.businessId = :businessId', { businessId })
      .getRawOne<{ sum: string }>();
    const totalViews = Number(viewsRow?.sum ?? 0);
    return {
      totalPages,
      publishedPages,
      draftPages: totalPages - publishedPages,
      totalBanners,
      activeBanners,
      totalViews,
    };
  }

  // ---------- Public ----------

  async publicConfig(businessId: string): Promise<StorefrontConfigResponseDto> {
    return this.getConfig(businessId);
  }

  /**
   * Resolve a businessId from the request hostname (custom domain). Lets a
   * single storefront deployment serve any merchant by domain — e.g.
   * scoops.ng -> the business whose `customDomain` is "scoops.ng".
   */
  async resolveByDomain(host: string): Promise<{ businessId: string }> {
    const normalized = (host ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .replace(/^www\./, '');
    if (!normalized) throw new BadRequestException('host is required');
    const config = await this.configRepo
      .createQueryBuilder('c')
      .where('LOWER(c.customDomain) = :host', { host: normalized })
      .getOne();
    if (!config) throw new NotFoundException('No storefront for this domain');
    return { businessId: config.businessId };
  }

  /**
   * Public, sanitised list of enabled payment methods for checkout. For
   * `transfer` methods the bank details from `config` are exposed so the
   * storefront can show deposit/transfer instructions (e.g. wallet top-up).
   */
  async publicPaymentMethods(businessId: string): Promise<
    Array<{
      id: string;
      type: string;
      label: string;
      order: number;
      bank?: { bankName?: string; accountNumber?: string; accountName?: string };
    }>
  > {
    const allEnabled = await this.paymentMethodRepo.find({
      where: { businessId, isEnabled: true },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    // Only surface methods configured to show on the Storefront channel.
    // Treat an empty visibility list as "all channels" for backwards compat.
    const methods = allEnabled.filter(
      (m) => !m.visibility?.length || m.visibility.includes('storefront'),
    );
    return methods.map((m) => {
      const cfg = (m.config ?? {}) as Record<string, unknown>;
      const base = { id: m.id, type: m.type, label: m.label, order: m.order };
      if (m.type === 'transfer') {
        return {
          ...base,
          bank: {
            bankName: typeof cfg.bankName === 'string' ? cfg.bankName : undefined,
            accountNumber:
              typeof cfg.accountNumber === 'string' ? cfg.accountNumber : undefined,
            accountName:
              typeof cfg.accountName === 'string' ? cfg.accountName : undefined,
          },
        };
      }
      return base;
    });
  }

  async publicBanners(
    businessId: string,
  ): Promise<StorefrontBannerResponseDto[]> {
    const now = new Date();
    const qb = this.bannerRepo
      .createQueryBuilder('b')
      .where('b.businessId = :businessId', { businessId })
      .andWhere('b.isActive = true')
      .andWhere('(b.startsAt IS NULL OR b.startsAt <= :now)', { now })
      .andWhere('(b.endsAt IS NULL OR b.endsAt >= :now)', { now })
      .orderBy('b.position', 'ASC')
      .addOrderBy('b.createdAt', 'DESC');
    const data = await qb.getMany();
    return data.map(StorefrontBannerResponseDto.from);
  }

  async publicPages(businessId: string): Promise<StorefrontPageResponseDto[]> {
    const pages = await this.pageRepo.find({
      where: { businessId, status: PageStatus.PUBLISHED },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return pages.map(StorefrontPageResponseDto.from);
  }

  async publicPageBySlug(
    businessId: string,
    slug: string,
    visitMeta?: { ip?: string; userAgent?: string },
  ): Promise<StorefrontPageResponseDto> {
    const page = await this.pageRepo.findOne({
      where: { businessId, slug, status: PageStatus.PUBLISHED },
    });
    if (!page) throw new NotFoundException('Page not found');

    // Record a view (fire-and-forget)
    void this.viewRepo
      .save(
        this.viewRepo.create({
          pageId: page.id,
          businessId,
          ip: visitMeta?.ip ?? null,
          userAgent: visitMeta?.userAgent ?? null,
        }),
      )
      .catch(() => undefined);
    void this.pageRepo
      .increment({ id: page.id }, 'views', 1)
      .catch(() => undefined);

    return StorefrontPageResponseDto.from(page);
  }
}
