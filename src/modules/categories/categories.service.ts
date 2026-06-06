import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { CategoryEntity, CategoryType } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FilterCategoryDto } from './dto/filter-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
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

  async create(businessId: string, dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const { imageFileId, imageUrl, ...rest } = dto;
    const category = this.categoryRepo.create({ ...rest, businessId });
    await this.resolveImageFields(category, { imageFileId, imageUrl });
    const saved = await this.categoryRepo.save(category);
    return CategoryResponseDto.from(saved);
  }

  async findAll(
    businessId: string,
    query: FilterCategoryDto,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    const { page = 1, limit = 20, search, status, type } = query;
    const where: FindOptionsWhere<CategoryEntity> = { businessId };

    if (status !== undefined) where.isActive = status;
    if (type) where.type = type;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.categoryRepo.findAndCount({
      where,
      order: { order: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Annotate each row with its product count. Single grouped query bounded
    // by this page's category ids, then merged onto the entities.
    const ids = data.map((c) => c.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const rows = await this.categoryRepo.manager
        .createQueryBuilder()
        .select('p.categoryId', 'categoryId')
        .addSelect('COUNT(p.id)', 'count')
        .from('products', 'p')
        .where('p.categoryId IN (:...ids)', { ids })
        .andWhere('p.deletedAt IS NULL')
        .groupBy('p.categoryId')
        .getRawMany<{ categoryId: string; count: string }>();
      for (const row of rows) counts.set(row.categoryId, parseInt(row.count, 10));
    }

    const enriched = data.map((c) =>
      Object.assign(c, { productCount: counts.get(c.id) ?? 0 }),
    );
    return paginate(enriched, total, page, limit, CategoryResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<CategoryResponseDto> {
    const category = await this.findEntity(businessId, id);
    return CategoryResponseDto.from(category);
  }

  private async findEntity(businessId: string, id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id, businessId } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async getStats(businessId: string, type?: CategoryType) {
    const baseWhere: FindOptionsWhere<CategoryEntity> = { businessId };
    if (type) baseWhere.type = type;

    const [total, active, byTypeRaw] = await Promise.all([
      this.categoryRepo.count({ where: baseWhere }),
      this.categoryRepo.count({ where: { ...baseWhere, isActive: true } }),
      type
        ? Promise.resolve([])
        : this.categoryRepo
            .createQueryBuilder('c')
            .select('c.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('c.businessId = :businessId', { businessId })
            .groupBy('c.type')
            .getRawMany<{ type: CategoryType; count: string }>(),
    ]);

    const byType = Object.values(CategoryType).reduce(
      (acc, t) => ({ ...acc, [t]: 0 }),
      {} as Record<CategoryType, number>,
    );
    for (const row of byTypeRaw) byType[row.type] = parseInt(row.count, 10);

    return { total, active, inactive: total - active, byType };
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.findEntity(businessId, id);
    const { imageFileId, imageUrl, ...rest } = dto;
    Object.assign(category, rest);
    await this.resolveImageFields(category, { imageFileId, imageUrl });
    const saved = await this.categoryRepo.save(category);
    return CategoryResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.categoryRepo.softDelete(id);
  }

  async reorder(businessId: string, dto: ReorderCategoriesDto): Promise<void> {
    // Verify all referenced categories belong to this business before reordering.
    const ids = dto.items.map((it) => it.id);
    if (ids.length === 0) return;
    const found = await this.categoryRepo.count({
      where: ids.map((id) => ({ id, businessId })),
    });
    if (found !== ids.length) {
      throw new NotFoundException('One or more categories not found in your business');
    }
    await Promise.all(
      dto.items.map(({ id, order }) => this.categoryRepo.update(id, { order })),
    );
  }
}
