import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkstationSettingsEntity } from './entities/workstation-settings.entity';
import { UpdateWorkstationSettingsDto } from './dto/update-workstation-settings.dto';
import { WorkstationSettingsResponseDto } from './dto/workstation-settings-response.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { StoreEntity } from '../store/entities/store.entity';
import { BusinessSettingsEntity } from '../business/entities/business-settings.entity';

@Injectable()
export class WorkstationSettingsService {
  constructor(
    @InjectRepository(WorkstationSettingsEntity)
    private readonly repo: Repository<WorkstationSettingsEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(BusinessSettingsEntity)
    private readonly businessSettingsRepo: Repository<BusinessSettingsEntity>,
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
    return {
      storeName: store?.name ?? null,
      address: store?.address ?? null,
      phone: store?.phone ?? null,
      receiptHeader: settings?.receiptHeader ?? null,
      receiptFooter: settings?.receiptFooter ?? null,
      showServerName: settings?.receiptShowServerName ?? false,
    };
  }

  async get(businessId: string): Promise<WorkstationSettingsResponseDto> {
    return WorkstationSettingsResponseDto.from(
      await this.getEntity(businessId),
    );
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
