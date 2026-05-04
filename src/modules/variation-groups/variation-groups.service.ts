import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { VariationGroupEntity } from './entities/variation-group.entity';
import { VariationOptionEntity } from './entities/variation-option.entity';
import { CreateVariationGroupDto } from './dto/create-variation-group.dto';
import { UpdateVariationGroupDto } from './dto/update-variation-group.dto';
import { FilterVariationGroupDto } from './dto/filter-variation-group.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class VariationGroupsService {
  constructor(
    @InjectRepository(VariationGroupEntity)
    private readonly groupRepo: Repository<VariationGroupEntity>,
    @InjectRepository(VariationOptionEntity)
    private readonly optionRepo: Repository<VariationOptionEntity>,
  ) {}

  async create(dto: CreateVariationGroupDto): Promise<VariationGroupEntity> {
    const { options, ...groupData } = dto;
    const group = this.groupRepo.create(groupData);
    if (options?.length) {
      group.options = options.map((o) => this.optionRepo.create(o));
    }
    return this.groupRepo.save(group);
  }

  async findAll(query: FilterVariationGroupDto): Promise<PaginatedResponseDto<VariationGroupEntity>> {
    const { page = 1, limit = 20, storeId, search } = query;
    const where: FindOptionsWhere<VariationGroupEntity> = {};

    if (storeId) where.storeId = storeId;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.groupRepo.findAndCount({
      where,
      relations: ['options'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string): Promise<VariationGroupEntity> {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: ['options'],
    });
    if (!group) throw new NotFoundException(`Variation group ${id} not found`);
    return group;
  }

  async getStats(storeId?: string) {
    const where: FindOptionsWhere<VariationGroupEntity> = {};
    if (storeId) where.storeId = storeId;

    const groups = await this.groupRepo.find({
      where,
      relations: ['options'],
    });
    const totalOptions = groups.reduce((sum, g) => sum + (g.options?.length ?? 0), 0);

    return { groups: groups.length, totalOptions };
  }

  async update(id: string, dto: UpdateVariationGroupDto): Promise<VariationGroupEntity> {
    const group = await this.findOne(id);
    const { options, ...groupData } = dto;
    Object.assign(group, groupData);

    if (options !== undefined) {
      await this.optionRepo.delete({ variationGroupId: id });
      group.options = options.map((o) => this.optionRepo.create({ ...o, variationGroupId: id }));
    }

    return this.groupRepo.save(group);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.groupRepo.softDelete(id);
  }
}
