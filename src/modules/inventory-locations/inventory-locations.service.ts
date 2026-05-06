import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { CreateInventoryLocationDto } from './dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from './dto/update-inventory-location.dto';
import { InventoryLocationFilterDto } from './dto/inventory-location-filter.dto';
import { InventoryLocationResponseDto } from './dto/inventory-location-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class InventoryLocationsService {
  constructor(
    @InjectRepository(InventoryLocationEntity)
    private readonly repo: Repository<InventoryLocationEntity>,
  ) {}

  async findAll(
    filter: InventoryLocationFilterDto,
  ): Promise<PaginatedResponseDto<InventoryLocationResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('l')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('l.createdAt', 'DESC');

    if (filter.storeId)
      qb.andWhere('l.storeId = :storeId', { storeId: filter.storeId });
    if (filter.type) qb.andWhere('l.type = :type', { type: filter.type });
    if (filter.search)
      qb.andWhere('l.name ILIKE :s', { s: `%${filter.search}%` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, (e) =>
      InventoryLocationResponseDto.from(e, { itemCount: 0 }),
    );
  }

  async findOne(id: string): Promise<InventoryLocationResponseDto> {
    const location = await this.repo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Inventory location not found');
    return InventoryLocationResponseDto.from(location);
  }

  async create(
    dto: CreateInventoryLocationDto,
  ): Promise<InventoryLocationResponseDto> {
    if (dto.isDefault) {
      await this.repo.update(
        { storeId: dto.storeId, isDefault: true },
        { isDefault: false },
      );
    }
    const created = await this.repo.save(this.repo.create(dto));
    return InventoryLocationResponseDto.from(created);
  }

  async update(
    id: string,
    dto: UpdateInventoryLocationDto,
  ): Promise<InventoryLocationResponseDto> {
    const location = await this.repo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Inventory location not found');
    if (dto.isDefault) {
      await this.repo.update(
        { storeId: location.storeId, isDefault: true },
        { isDefault: false },
      );
    }
    Object.assign(location, dto);
    const saved = await this.repo.save(location);
    return InventoryLocationResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const location = await this.repo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Inventory location not found');
    await this.repo.softRemove(location);
  }
}
