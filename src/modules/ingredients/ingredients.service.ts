import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { IngredientEntity } from './entities/ingredient.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(IngredientEntity)
    private readonly ingredientRepo: Repository<IngredientEntity>,
  ) {}

  async create(dto: CreateIngredientDto): Promise<IngredientEntity> {
    const ingredient = this.ingredientRepo.create(dto);
    return this.ingredientRepo.save(ingredient);
  }

  async findAll(query: FilterIngredientDto): Promise<PaginatedResponseDto<IngredientEntity>> {
    const { page = 1, limit = 20, storeId, search, status } = query;

    const qb = this.ingredientRepo.createQueryBuilder('i');
    if (storeId) qb.andWhere('i.storeId = :storeId', { storeId });
    if (search) qb.andWhere('i.name ILIKE :search', { search: `%${search}%` });
    if (status === 'low') qb.andWhere('i.currentStock <= i.minStock');

    qb.orderBy('i.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string): Promise<IngredientEntity> {
    const ingredient = await this.ingredientRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);
    return ingredient;
  }

  async getStats(storeId?: string) {
    const where: FindOptionsWhere<IngredientEntity> = {};
    if (storeId) where.storeId = storeId;

    const all = await this.ingredientRepo.find({ where });
    const lowStock = all.filter(
      (i) => Number(i.currentStock) <= Number(i.minStock),
    ).length;
    const totalValue = all.reduce(
      (sum, i) => sum + Number(i.currentStock) * Number(i.costPerUnit),
      0,
    );
    const supplierIds = new Set(all.map((i) => i.supplierId).filter(Boolean));

    return {
      total: all.length,
      lowStock,
      totalValue,
      supplierCount: supplierIds.size,
    };
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<IngredientEntity> {
    const ingredient = await this.findOne(id);
    Object.assign(ingredient, dto);
    return this.ingredientRepo.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.ingredientRepo.softDelete(id);
  }

  async adjustStock(id: string, dto: AdjustStockDto): Promise<IngredientEntity> {
    const ingredient = await this.findOne(id);
    ingredient.currentStock = Number(ingredient.currentStock) + dto.adjustment;
    if (dto.adjustment > 0) ingredient.lastRestocked = new Date();
    return this.ingredientRepo.save(ingredient);
  }
}
