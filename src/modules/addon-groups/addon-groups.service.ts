import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { AddOnGroupEntity } from './entities/addon-group.entity';
import { AddOnEntity } from './entities/addon.entity';
import { CreateAddOnGroupDto, CreateAddOnDto } from './dto/create-addon-group.dto';
import { UpdateAddOnGroupDto, UpdateAddOnDto } from './dto/update-addon-group.dto';
import { FilterAddOnGroupDto } from './dto/filter-addon-group.dto';
import {
  AddOnGroupResponseDto,
  AddOnResponseDto,
} from './dto/addon-group-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class AddOnGroupsService {
  constructor(
    @InjectRepository(AddOnGroupEntity)
    private readonly groupRepo: Repository<AddOnGroupEntity>,
    @InjectRepository(AddOnEntity)
    private readonly addonRepo: Repository<AddOnEntity>,
  ) {}

  async create(businessId: string, dto: CreateAddOnGroupDto): Promise<AddOnGroupResponseDto> {
    const { addons, ...groupData } = dto;
    this.validateSelection(groupData.minSelection, groupData.maxSelection, addons?.length ?? 0);
    const group = this.groupRepo.create({ ...groupData, businessId });
    if (addons?.length) {
      group.addons = addons.map((a) => this.addonRepo.create(a));
    }
    const saved = await this.groupRepo.save(group);
    return AddOnGroupResponseDto.from(saved);
  }

  async findAll(
    businessId: string,
    query: FilterAddOnGroupDto,
  ): Promise<PaginatedResponseDto<AddOnGroupResponseDto>> {
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

    return paginate(data, total, page, limit, AddOnGroupResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<AddOnGroupResponseDto> {
    return AddOnGroupResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(businessId: string, id: string): Promise<AddOnGroupEntity> {
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
  ): Promise<AddOnGroupResponseDto> {
    const group = await this.findEntity(businessId, id);
    Object.assign(group, dto);
    this.validateSelection(group.minSelection, group.maxSelection, group.addons?.length ?? 0);
    const saved = await this.groupRepo.save(group);
    return AddOnGroupResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.groupRepo.softDelete(id);
  }

  async addAddon(businessId: string, groupId: string, dto: CreateAddOnDto): Promise<AddOnResponseDto> {
    await this.findEntity(businessId, groupId);
    const addon = this.addonRepo.create({ ...dto, addOnGroupId: groupId });
    const saved = await this.addonRepo.save(addon);
    return AddOnResponseDto.from(saved);
  }

  async updateAddon(
    businessId: string,
    groupId: string,
    addonId: string,
    dto: UpdateAddOnDto,
  ): Promise<AddOnResponseDto> {
    await this.findEntity(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    Object.assign(addon, dto);
    const saved = await this.addonRepo.save(addon);
    return AddOnResponseDto.from(saved);
  }

  async removeAddon(businessId: string, groupId: string, addonId: string): Promise<void> {
    await this.findEntity(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    await this.addonRepo.remove(addon);
  }

  async toggleAvailability(
    businessId: string,
    groupId: string,
    addonId: string,
  ): Promise<AddOnResponseDto> {
    await this.findEntity(businessId, groupId);
    const addon = await this.findAddon(groupId, addonId);
    addon.isAvailable = !addon.isAvailable;
    const saved = await this.addonRepo.save(addon);
    return AddOnResponseDto.from(saved);
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
