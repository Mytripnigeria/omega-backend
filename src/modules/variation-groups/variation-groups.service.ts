import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { VariationGroupEntity } from './entities/variation-group.entity';
import { VariationOptionEntity } from './entities/variation-option.entity';
import { CreateVariationGroupDto } from './dto/create-variation-group.dto';
import { UpdateVariationGroupDto } from './dto/update-variation-group.dto';
import { FilterVariationGroupDto } from './dto/filter-variation-group.dto';
import { VariationGroupResponseDto } from './dto/variation-group-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class VariationGroupsService {
  constructor(
    @InjectRepository(VariationGroupEntity)
    private readonly groupRepo: Repository<VariationGroupEntity>,
    @InjectRepository(VariationOptionEntity)
    private readonly optionRepo: Repository<VariationOptionEntity>,
  ) {}

  async create(businessId: string, dto: CreateVariationGroupDto): Promise<VariationGroupResponseDto> {
    const { options, ...groupData } = dto;
    const group = this.groupRepo.create({ ...groupData, businessId });
    if (options?.length) {
      group.options = options.map((o) => this.optionRepo.create(o));
    }
    const saved = await this.groupRepo.save(group);
    return VariationGroupResponseDto.from(saved);
  }

  async findAll(
    businessId: string,
    query: FilterVariationGroupDto,
  ): Promise<PaginatedResponseDto<VariationGroupResponseDto>> {
    const { page = 1, limit = 20, search } = query;
    const where: FindOptionsWhere<VariationGroupEntity> = { businessId };

    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.groupRepo.findAndCount({
      where,
      relations: ['options'],
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(data, total, page, limit, VariationGroupResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<VariationGroupResponseDto> {
    return VariationGroupResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(businessId: string, id: string): Promise<VariationGroupEntity> {
    const group = await this.groupRepo.findOne({
      where: { id, businessId },
      relations: ['options'],
    });
    if (!group) throw new NotFoundException(`Variation group ${id} not found`);
    return group;
  }

  async getStats(businessId: string) {
    const groups = await this.groupRepo.find({
      where: { businessId },
      relations: ['options'],
    });
    const totalOptions = groups.reduce((sum, g) => sum + (g.options?.length ?? 0), 0);
    return { groups: groups.length, totalOptions };
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateVariationGroupDto,
  ): Promise<VariationGroupResponseDto> {
    const group = await this.findEntity(businessId, id);
    const { options, ...groupData } = dto;
    Object.assign(group, groupData);

    if (options !== undefined) {
      await this.optionRepo.delete({ variationGroupId: id });
      group.options = options.map((o) => this.optionRepo.create({ ...o, variationGroupId: id }));
    }

    const saved = await this.groupRepo.save(group);
    return VariationGroupResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.groupRepo.softDelete(id);
  }
}
