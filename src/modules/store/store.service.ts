import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  /**
   * `allowedStoreIds` restricts the result to the stores the caller may work
   * in — a staff member granted merchant-dashboard access can be scoped to
   * their own branch. `null` means unrestricted (the business owner).
   *
   * The hub drives every store-scoped screen from this list, so filtering here
   * is what makes a restricted login actually restricted.
   */
  async findAll(
    businessId: string,
    query: PaginationQueryDto,
    allowedStoreIds: string[] | null = null,
  ): Promise<PaginatedResponseDto<StoreResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await this.storeRepo.findAndCount({
      where: allowedStoreIds
        ? { businessId, id: In(allowedStoreIds) }
        : { businessId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, page, limit, StoreResponseDto.from);
  }

  async findOne(
    businessId: string,
    id: string,
    allowedStoreIds: string[] | null = null,
  ): Promise<StoreResponseDto> {
    return StoreResponseDto.from(
      await this.findEntity(businessId, id, allowedStoreIds),
    );
  }

  private async findEntity(
    businessId: string,
    id: string,
    allowedStoreIds: string[] | null = null,
  ): Promise<StoreEntity> {
    const store = await this.storeRepo.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    if (allowedStoreIds && !allowedStoreIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this store');
    }
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
