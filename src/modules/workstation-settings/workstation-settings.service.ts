import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkstationSettingsEntity } from './entities/workstation-settings.entity';
import { WorkstationGeofenceEntity } from './entities/workstation-geofence.entity';
import { UpsertGeofenceDto } from './dto/workstation-geofence.dto';
import { UpdateWorkstationSettingsDto } from './dto/update-workstation-settings.dto';
import { WorkstationSettingsResponseDto } from './dto/workstation-settings-response.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { StoreEntity } from '../store/entities/store.entity';
import { BusinessSettingsEntity } from '../business/entities/business-settings.entity';
import { TaxRateEntity } from '../tax-rates/entities/tax-rate.entity';

@Injectable()
export class WorkstationSettingsService {
  constructor(
    @InjectRepository(WorkstationSettingsEntity)
    private readonly repo: Repository<WorkstationSettingsEntity>,
    @InjectRepository(WorkstationGeofenceEntity)
    private readonly geofenceRepo: Repository<WorkstationGeofenceEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(BusinessSettingsEntity)
    private readonly businessSettingsRepo: Repository<BusinessSettingsEntity>,
    @InjectRepository(TaxRateEntity)
    private readonly taxRateRepo: Repository<TaxRateEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Receipt header/footer/store details for the POS receipt — pulled from the
   * store record and the business receipt settings so the workstation no
   * longer hardcodes them.
   */
  async getReceiptInfo(businessId: string, storeId?: string) {
    const store = storeId
      ? await this.storeRepo.findOne({ where: { id: storeId, businessId } })
      : null;
    const settings = await this.businessSettingsRepo.findOne({
      where: { businessId },
    });
    // The POS used to hardcode 7.5% VAT. Tax is a business-profile setting, so
    // ship it with the receipt info (the only staff-readable settings endpoint)
    // and let the counter price from it. A configured default tax rate takes
    // precedence over the legacy business-settings fraction.
    const defaultTaxRate = await this.taxRateRepo.findOne({
      where: { businessId, isActive: true, isDefault: true },
    });
    const taxRate = defaultTaxRate
      ? Number(defaultTaxRate.ratePercent) / 100
      : Number(settings?.taxRate ?? 0);

    return {
      storeName: store?.name ?? null,
      address: store?.address ?? null,
      phone: store?.phone ?? null,
      receiptHeader: settings?.receiptHeader ?? null,
      receiptFooter: settings?.receiptFooter ?? null,
      showServerName: settings?.receiptShowServerName ?? false,
      // Fraction, e.g. 0.075 — matches how the storefront prices tax.
      taxRate,
      taxLabel: defaultTaxRate?.name ?? 'VAT',
      taxInclusive: defaultTaxRate?.isInclusive ?? false,
      showTaxBreakdown: settings?.receiptShowTaxBreakdown ?? true,
    };
  }

  /**
   * One store's workstation settings, created on first read.
   *
   * These were a per-business record, so three branches shared one PIN policy,
   * one clock-in window and one geofence. They are per store now, and a store
   * that has never been configured starts from the defaults rather than from
   * another branch's rules.
   */
  async get(
    businessId: string,
    storeId: string,
  ): Promise<WorkstationSettingsResponseDto> {
    return WorkstationSettingsResponseDto.from(
      await this.getEntity(businessId, storeId),
    );
  }

  /**
   * Staff-readable slice of the settings: which workstation functions are
   * restricted to which roles. The workstation app gates its pages on this.
   */
  async getFunctionAccess(
    businessId: string,
    storeId: string,
  ): Promise<{ functionRoleAccess: Record<string, string[]> | null }> {
    // An admin may ask without naming a store; there is no map to give, and an
    // empty string would reach Postgres as a broken uuid.
    if (!storeId) return { functionRoleAccess: null };
    // Scoped by business as well as store: the storeId can arrive as a query
    // parameter, and one merchant must not be able to read another's setup.
    const settings = await this.repo.findOne({ where: { storeId, businessId } });
    return { functionRoleAccess: settings?.functionRoleAccess ?? null };
  }

  private async assertStore(businessId: string, storeId: string): Promise<void> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, businessId },
    });
    if (!store) throw new NotFoundException('Store not found in this business');
  }

  private async getEntity(
    businessId: string,
    storeId: string,
  ): Promise<WorkstationSettingsEntity> {
    await this.assertStore(businessId, storeId);
    let settings = await this.repo.findOne({ where: { storeId } });
    if (!settings) {
      // A branch opened after the others starts from the business's FIRST
      // branch, not from bare defaults. Function access in particular is a
      // restriction the merchant put in place deliberately, and a new branch
      // quietly ignoring it would loosen the workstation without anyone asking.
      // The first branch is used rather than "whichever was edited last",
      // which would make what a new branch inherits depend on the order the
      // merchant happened to open screens in. It is ordered by when the STORE
      // was opened, not when its settings row was written: rows are created
      // lazily on first read, so their own order is just browsing history.
      const sibling = await this.repo
        .createQueryBuilder('w')
        .innerJoin(StoreEntity, 's', 's.id = w."storeId"')
        .where('w."businessId" = :businessId', { businessId })
        .orderBy('s."createdAt"', 'ASC')
        .getOne();
      const inherited = sibling
        ? (({ storeId: _s, createdAt: _c, updatedAt: _u, ...rest }) => rest)(
            sibling,
          )
        : {};
      settings = this.repo.create({ ...inherited, storeId, businessId });
      settings = await this.repo.save(settings);
    }
    return settings;
  }

  async update(
    businessId: string,
    storeId: string,
    actor: { sub: string; email?: string },
    dto: UpdateWorkstationSettingsDto,
  ): Promise<WorkstationSettingsResponseDto> {
    const settings = await this.getEntity(businessId, storeId);
    Object.assign(settings, dto);
    const saved = await this.repo.save(settings);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'workstation_settings.updated',
      businessId,
      storeId,
      resourceType: 'workstation_settings',
      resourceId: storeId,
      metadata: { fields: Object.keys(dto) },
    });

    return WorkstationSettingsResponseDto.from(saved);
  }

  // ───────────────────── geofence places ─────────────────────

  /**
   * Everywhere this store's staff may sign in and clock in from. A store can
   * have several — a dining room and a kitchen unit down the road — and being
   * at any of them counts.
   */
  async listGeofences(
    businessId: string,
    storeId: string,
  ): Promise<WorkstationGeofenceEntity[]> {
    await this.assertStore(businessId, storeId);
    return this.geofenceRepo.find({
      where: { storeId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Places actually enforced at login: the active ones. */
  async activeGeofences(storeId: string): Promise<WorkstationGeofenceEntity[]> {
    return this.geofenceRepo.find({ where: { storeId, isActive: true } });
  }

  async addGeofence(
    businessId: string,
    storeId: string,
    actor: { sub: string; email?: string },
    dto: UpsertGeofenceDto,
  ): Promise<WorkstationGeofenceEntity> {
    await this.assertStore(businessId, storeId);
    const saved = await this.geofenceRepo.save(
      this.geofenceRepo.create({
        storeId,
        businessId,
        label: dto.label,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusMeters: dto.radiusMeters ?? 100,
        isActive: dto.isActive ?? true,
      }),
    );
    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'workstation_geofence.added',
      businessId,
      storeId,
      resourceType: 'workstation_geofence',
      resourceId: saved.id,
      metadata: { label: saved.label },
    });
    return saved;
  }

  async updateGeofence(
    businessId: string,
    storeId: string,
    id: string,
    dto: UpsertGeofenceDto,
  ): Promise<WorkstationGeofenceEntity> {
    const place = await this.geofenceRepo.findOne({ where: { id, storeId, businessId } });
    if (!place) throw new NotFoundException('Location not found for this store');
    Object.assign(place, {
      label: dto.label ?? place.label,
      latitude: dto.latitude ?? place.latitude,
      longitude: dto.longitude ?? place.longitude,
      radiusMeters: dto.radiusMeters ?? place.radiusMeters,
      isActive: dto.isActive ?? place.isActive,
    });
    return this.geofenceRepo.save(place);
  }

  async removeGeofence(
    businessId: string,
    storeId: string,
    id: string,
  ): Promise<void> {
    const place = await this.geofenceRepo.findOne({ where: { id, storeId, businessId } });
    if (!place) throw new NotFoundException('Location not found for this store');
    await this.geofenceRepo.delete({ id });
  }
}
