import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessEntity } from './entities/business.entity';
import { BusinessSettingsEntity } from './entities/business-settings.entity';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { BusinessResponseDto } from './dto/business-response.dto';
import { BusinessSettingsResponseDto } from './dto/business-settings-response.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businessRepo: Repository<BusinessEntity>,
    @InjectRepository(BusinessSettingsEntity)
    private readonly settingsRepo: Repository<BusinessSettingsEntity>,
    private readonly storage: StorageService,
  ) {}

  async findById(id: string): Promise<BusinessResponseDto> {
    return BusinessResponseDto.from(await this.findEntity(id));
  }

  private async findEntity(id: string): Promise<BusinessEntity> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) throw new NotFoundException(`Business ${id} not found`);
    return business;
  }

  async createDefaultForAdmin(adminFullName: string): Promise<BusinessEntity> {
    const business = this.businessRepo.create({
      name: adminFullName ? `${adminFullName}'s Business` : 'My Business',
    });
    return this.businessRepo.save(business);
  }

  async update(id: string, dto: UpdateBusinessDto): Promise<BusinessResponseDto> {
    const business = await this.findEntity(id);
    const { logoFileId, ...rest } = dto;

    if (logoFileId !== undefined) {
      if (logoFileId === null) {
        business.logoFileId = null;
        business.logoUrl = null as unknown as string;
      } else {
        const file = await this.storage.findById(logoFileId);
        business.logoFileId = file.id;
        business.logoUrl = file.url;
      }
    }

    Object.assign(business, rest);
    const saved = await this.businessRepo.save(business);
    return BusinessResponseDto.from(saved);
  }

  async getSettings(businessId: string): Promise<BusinessSettingsResponseDto> {
    return BusinessSettingsResponseDto.from(await this.getSettingsEntity(businessId));
  }

  private async getSettingsEntity(businessId: string): Promise<BusinessSettingsEntity> {
    let settings = await this.settingsRepo.findOne({ where: { businessId } });
    if (!settings) {
      settings = this.settingsRepo.create({ businessId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(
    businessId: string,
    dto: UpdateBusinessSettingsDto,
  ): Promise<BusinessSettingsResponseDto> {
    const settings = await this.getSettingsEntity(businessId);
    Object.assign(settings, dto);
    const saved = await this.settingsRepo.save(settings);
    return BusinessSettingsResponseDto.from(saved);
  }
}
