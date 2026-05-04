import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariationEntity } from './entities/product-variation.entity';
import { ProductIngredientEntity } from './entities/product-ingredient.entity';
import { AddOnGroupEntity } from '../addon-groups/entities/addon-group.entity';
import { CreateProductDto, CreateVariationDto, CreateProductIngredientDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariationDto, ToggleProductStatusDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { LinkIngredientDto } from './dto/link-ingredient.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductVariationEntity)
    private readonly variationRepo: Repository<ProductVariationEntity>,
    @InjectRepository(ProductIngredientEntity)
    private readonly productIngredientRepo: Repository<ProductIngredientEntity>,
    @InjectRepository(AddOnGroupEntity)
    private readonly addonGroupRepo: Repository<AddOnGroupEntity>,
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

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const { variations, ingredients, addonGroupIds, imageFileId, imageUrl, ...productData } = dto;
    const product = this.productRepo.create(productData);
    await this.resolveImageFields(product, { imageFileId, imageUrl });

    if (variations?.length) {
      product.variations = variations.map((v) =>
        this.variationRepo.create(v),
      );
    }

    if (ingredients?.length) {
      product.productIngredients = ingredients.map((i) =>
        this.productIngredientRepo.create(i),
      );
    }

    if (addonGroupIds?.length) {
      product.addonGroups = await this.addonGroupRepo.findBy({
        id: In(addonGroupIds),
      });
    }

    return this.productRepo.save(product);
  }

  async findAll(query: FilterProductDto): Promise<PaginatedResponseDto<ProductEntity>> {
    const { page = 1, limit = 20, storeId, categoryId, status, search } = query;
    const where: FindOptionsWhere<ProductEntity> = {};

    if (storeId) where.storeId = storeId;
    if (categoryId) where.categoryId = categoryId;
    if (status !== undefined) where.status = status;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.productRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['variations', 'productIngredients', 'productIngredients.ingredient', 'addonGroups', 'addonGroups.addons'],
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getStats(storeId?: string) {
    const where: FindOptionsWhere<ProductEntity> = {};
    if (storeId) where.storeId = storeId;

    const [total, active] = await Promise.all([
      this.productRepo.count({ where }),
      this.productRepo.count({ where: { ...where, status: true } }),
    ]);

    const outOfStock = await this.productRepo.count({
      where: { ...where, stock: 0 },
    });

    const categories = await this.productRepo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.categoryId)', 'count')
      .where(storeId ? 'p.storeId = :storeId' : '1=1', { storeId })
      .getRawOne<{ count: string }>();

    return {
      total,
      active,
      inactive: total - active,
      outOfStock,
      categoryCount: parseInt(categories?.count ?? '0'),
    };
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await this.findOne(id);
    const { imageFileId, imageUrl, ...rest } = dto;
    Object.assign(product, rest);
    await this.resolveImageFields(product, { imageFileId, imageUrl });
    return this.productRepo.save(product);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.productRepo.softDelete(id);
  }

  async toggleStatus(id: string, dto: ToggleProductStatusDto): Promise<ProductEntity> {
    const product = await this.findOne(id);
    product.status = dto.status;
    return this.productRepo.save(product);
  }

  async addVariation(productId: string, dto: CreateVariationDto): Promise<ProductVariationEntity> {
    await this.findOne(productId);
    const variation = this.variationRepo.create({ ...dto, productId });
    return this.variationRepo.save(variation);
  }

  async updateVariation(
    productId: string,
    varId: string,
    dto: UpdateVariationDto,
  ): Promise<ProductVariationEntity> {
    const variation = await this.findVariation(productId, varId);
    Object.assign(variation, dto);
    return this.variationRepo.save(variation);
  }

  async removeVariation(productId: string, varId: string): Promise<void> {
    const variation = await this.findVariation(productId, varId);
    await this.variationRepo.remove(variation);
  }

  async linkIngredient(productId: string, dto: LinkIngredientDto): Promise<ProductIngredientEntity> {
    await this.findOne(productId);
    const pi = this.productIngredientRepo.create({ ...dto, productId });
    return this.productIngredientRepo.save(pi);
  }

  async unlinkIngredient(productId: string, ingredientId: string): Promise<void> {
    const pi = await this.productIngredientRepo.findOne({
      where: { productId, ingredientId },
    });
    if (!pi) throw new NotFoundException(`Ingredient link not found`);
    await this.productIngredientRepo.remove(pi);
  }

  async linkAddonGroup(productId: string, groupId: string): Promise<ProductEntity> {
    const [product, group] = await Promise.all([
      this.findOne(productId),
      this.addonGroupRepo.findOne({ where: { id: groupId } }),
    ]);
    if (!group) throw new NotFoundException(`Add-on group ${groupId} not found`);
    if (!product.addonGroups) product.addonGroups = [];
    if (!product.addonGroups.find((g) => g.id === groupId)) {
      product.addonGroups.push(group);
    }
    return this.productRepo.save(product);
  }

  async unlinkAddonGroup(productId: string, groupId: string): Promise<ProductEntity> {
    const product = await this.findOne(productId);
    product.addonGroups = (product.addonGroups ?? []).filter((g) => g.id !== groupId);
    return this.productRepo.save(product);
  }

  private async findVariation(productId: string, varId: string): Promise<ProductVariationEntity> {
    const variation = await this.variationRepo.findOne({
      where: { id: varId, productId },
    });
    if (!variation) throw new NotFoundException(`Variation ${varId} not found`);
    return variation;
  }
}
