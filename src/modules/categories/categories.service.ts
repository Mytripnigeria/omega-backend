import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FilterCategoryDto } from './dto/filter-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-category.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    private readonly storage: StorageService,
  ) {}

  private async resolveImageFields(
    target: { imageUrl?: string | null; imageFileId?: string | null },
    dto: { imageFileId?: string | null; imageUrl?: string | null },
  ): Promise<void> {
    if (dto.imageFileId !== undefined) {
      if (dto.imageFileId === null) {
        target.imageFileId = null;
        target.imageUrl = null;
      } else {
        const file = await this.storage.findById(dto.imageFileId);
        target.imageFileId = file.id;
        target.imageUrl = file.url;
      }
    } else if (dto.imageUrl !== undefined) {
      target.imageUrl = dto.imageUrl;
    }
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const { imageFileId, imageUrl, ...rest } = dto;
    const category = this.categoryRepo.create(rest);
    await this.resolveImageFields(category, { imageFileId, imageUrl });
    return this.categoryRepo.save(category);
  }

  async findAll(query: FilterCategoryDto): Promise<PaginatedResponseDto<CategoryEntity>> {
    const { page = 1, limit = 20, storeId, search, status } = query;
    const where: FindOptionsWhere<CategoryEntity> = {};

    if (storeId) where.storeId = storeId;
    if (status !== undefined) where.isActive = status;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.categoryRepo.findAndCount({
      where,
      order: { order: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async getStats(storeId?: string) {
    const where: FindOptionsWhere<CategoryEntity> = {};
    if (storeId) where.storeId = storeId;

    const [total, active] = await Promise.all([
      this.categoryRepo.count({ where }),
      this.categoryRepo.count({ where: { ...where, isActive: true } }),
    ]);

    return { total, active, inactive: total - active };
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.findOne(id);
    const { imageFileId, imageUrl, ...rest } = dto;
    Object.assign(category, rest);
    await this.resolveImageFields(category, { imageFileId, imageUrl });
    return this.categoryRepo.save(category);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.categoryRepo.softDelete(id);
  }

  async reorder(dto: ReorderCategoriesDto): Promise<void> {
    await Promise.all(
      dto.items.map(({ id, order }) =>
        this.categoryRepo.update(id, { order }),
      ),
    );
  }
}
