import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkstationSettingsEntity } from './entities/workstation-settings.entity';
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

  async get(businessId: string): Promise<WorkstationSettingsResponseDto> {
    return WorkstationSettingsResponseDto.from(
      await this.getEntity(businessId),
    );
  }

  /**
   * Staff-readable slice of the settings: which workstation functions are
   * restricted to which roles. The workstation app gates its pages on this.
   */
  async getFunctionAccess(
    businessId: string,
  ): Promise<{ functionRoleAccess: Record<string, string[]> | null }> {
    const settings = await this.repo.findOne({ where: { businessId } });
    return { functionRoleAccess: settings?.functionRoleAccess ?? null };
  }

  private async getEntity(businessId: string): Promise<WorkstationSettingsEntity> {
    let settings = await this.repo.findOne({ where: { businessId } });
    if (!settings) {
      settings = this.repo.create({ businessId });
      settings = await this.repo.save(settings);
    }
    return settings;
  }

  async update(
    businessId: string,
    actor: { sub: string; email?: string },
    dto: UpdateWorkstationSettingsDto,
  ): Promise<WorkstationSettingsResponseDto> {
    const settings = await this.getEntity(businessId);
    Object.assign(settings, dto);
    const saved = await this.repo.save(settings);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email ?? 'Admin',
      action: 'workstation_settings.updated',
      businessId,
      resourceType: 'workstation_settings',
      resourceId: businessId,
      metadata: { fields: Object.keys(dto) },
    });

    return WorkstationSettingsResponseDto.from(saved);
  }
}
