import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreEntity } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
  paginate,
} from '../../common/dto/pagination.dto';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
  ) {}

  async create(businessId: string, dto: CreateStoreDto): Promise<StoreResponseDto> {
    const store = this.storeRepo.create({ ...dto, businessId });
    const saved = await this.storeRepo.save(store);
    return StoreResponseDto.from(saved);
  }

  async findAll(
    businessId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<StoreResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await this.storeRepo.findAndCount({
      where: { businessId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, page, limit, StoreResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<StoreResponseDto> {
    return StoreResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(businessId: string, id: string): Promise<StoreEntity> {
    const store = await this.storeRepo.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.businessId !== businessId) {
      throw new ForbiddenException('Store does not belong to your business');
    }
    return store;
  }

  async update(businessId: string, id: string, dto: UpdateStoreDto): Promise<StoreResponseDto> {
    const store = await this.findEntity(businessId, id);
    Object.assign(store, dto);
    const saved = await this.storeRepo.save(store);
    return StoreResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.storeRepo.softDelete(id);
  }
}
