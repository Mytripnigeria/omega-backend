import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { AddOnGroupEntity } from './entities/addon-group.entity';
import { AddOnEntity } from './entities/addon.entity';
import { CreateAddOnGroupDto, CreateAddOnDto } from './dto/create-addon-group.dto';
import { UpdateAddOnGroupDto, UpdateAddOnDto } from './dto/update-addon-group.dto';
import { FilterAddOnGroupDto } from './dto/filter-addon-group.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AddOnGroupsService {
  constructor(
    @InjectRepository(AddOnGroupEntity)
    private readonly groupRepo: Repository<AddOnGroupEntity>,
    @InjectRepository(AddOnEntity)
    private readonly addonRepo: Repository<AddOnEntity>,
  ) {}

  async create(businessId: string, dto: CreateAddOnGroupDto): Promise<AddOnGroupEntity> {
    const { addons, ...groupData } = dto;
    this.validateSelection(groupData.minSelection, groupData.maxSelection, addons?.length ?? 0);
    const group = this.groupRepo.create({ ...groupData, businessId });
    if (addons?.length) {
      group.addons = addons.map((a) => this.addonRepo.create(a));
    }
    return this.groupRepo.save(group);
  }

  async findAll(
    businessId: string,
    query: FilterAddOnGroupDto,
  ): Promise<PaginatedResponseDto<AddOnGroupEntity>> {
    const { page = 1, limit = 20, search } = query;
    const where: FindOptionsWhere<AddOnGroupEntity> = { businessId };

    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.groupRepo.findAndCount({
      where,
      relations: ['addons'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(businessId: string, id: string): Promise<AddOnGroupEntity> {
    const group = await this.groupRepo.findOne({
      where: { id, businessId },
      relations: ['addons'],
    });
    if (!group) throw new NotFoundException(`Add-on group ${id} not found`);
    return group;
  }

  async getStats(businessId: string) {
    const groups = await this.groupRepo.find({
      where: { businessId },
      relations: ['addons'],
    });
    const totalAddons = groups.reduce((sum, g) => sum + (g.addons?.length ?? 0), 0);
    const availableAddons = groups.reduce(
      (sum, g) => sum + (g.addons?.filter((a) => a.isAvailable).length ?? 0),
      0,
    );

    return { totalGroups: groups.length, totalAddons, availableAddons };
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateAddOnGroupDto,
  ): Promise<AddOnGroupEntity> {
    const group = await this.findOne(businessId, id);
    Object.assign(group, dto);
    this.validateSelection(group.minSelection, group.maxSelection, group.addons?.length ?? 0);
    return this.groupRepo.save(group);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.groupRepo.softDelete(id);
  }

  async addAddon(businessId: string, groupId: string, dto: CreateAddOnDto): Promise<AddOnEntity> {
    await this.findOne(businessId, groupId);
    const addon = this.addonRepo.create({ ...dto, addOnGroupId: groupId });
    return this.addonRepo.save(addon);
  }

  async updateAddon(
    businessId: string,
    groupId: string,
    addonId: string,
    dto: UpdateAddOnDto,
  ): Promise<AddOnEntity> {
    await this.findOne(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    Object.assign(addon, dto);
    return this.addonRepo.save(addon);
  }

  async removeAddon(businessId: string, groupId: string, addonId: string): Promise<void> {
    await this.findOne(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    await this.addonRepo.remove(addon);
  }

  async toggleAvailability(
    businessId: string,
    groupId: string,
    addonId: string,
  ): Promise<AddOnEntity> {
    await this.findOne(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    addon.isAvailable = !addon.isAvailable;
    return this.addonRepo.save(addon);
  }

  private async findAddon(groupId: string, addonId: string): Promise<AddOnEntity> {
    const addon = await this.addonRepo.findOne({
      where: { id: addonId, addOnGroupId: groupId },
    });
    if (!addon) throw new NotFoundException(`Add-on ${addonId} not found in group ${groupId}`);
    return addon;
  }

  private validateSelection(
    min: number | null | undefined,
    max: number | null | undefined,
    addonsCount: number,
  ): void {
    if (min != null && min < 0) {
      throw new BadRequestException('minSelection cannot be negative');
    }
    if (min != null && max != null && min > max) {
      throw new BadRequestException('minSelection cannot exceed maxSelection');
    }
    if (max != null && max > addonsCount) {
      throw new BadRequestException('maxSelection exceeds available add-ons');
    }
  }
}
