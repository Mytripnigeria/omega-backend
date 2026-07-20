import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariationEntity } from './entities/product-variation.entity';
import { ProductIngredientEntity } from './entities/product-ingredient.entity';
import { AddOnGroupEntity } from '../addon-groups/entities/addon-group.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { CreateProductDto, CreateVariationDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariationDto, ToggleProductStatusDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { LinkIngredientDto } from './dto/link-ingredient.dto';
import {
  ProductResponseDto,
  ProductVariationResponseDto,
  ProductIngredientResponseDto,
} from './dto/product-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
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
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    private readonly storage: StorageService,
  ) {}

  /**
   * Attaches a denormalised categoryName to each product so clients can match
   * products to their category list even when categoryId points at a
   * soft-deleted (or otherwise stale) category — the cause of "category pills
   * missing on the POS although the items show under All".
   */
  private async attachCategoryNames(
    products: ProductEntity[],
  ): Promise<Array<ProductEntity & { categoryName: string | null }>> {
    // categoryId is a plain varchar column — guard against non-UUID junk
    // (e.g. "null") before querying the uuid-typed categories.id.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = Array.from(
      new Set(
        products
          .map((p) => p.categoryId)
          .filter((id): id is string => !!id && UUID_RE.test(id)),
      ),
    );
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const categories = await this.categoryRepo.find({
        where: { id: In(ids) },
        withDeleted: true,
      });
      for (const c of categories) names.set(c.id, c.name);
    }
    return products.map((p) =>
      Object.assign(p, {
        categoryName: p.categoryId ? (names.get(p.categoryId) ?? null) : null,
      }),
    );
  }

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

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const { variations, ingredients, addonGroupIds, imageFileId, imageUrl, ...productData } = dto;
    const product = this.productRepo.create(productData);
    await this.resolveImageFields(product, { imageFileId, imageUrl });

    if (variations?.length) {
      product.variations = variations.map((v) => this.variationRepo.create(v));
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

    const saved = await this.productRepo.save(product);
    return this.findOne(saved.id);
  }

  async findAll(query: FilterProductDto): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const { page = 1, limit = 20, storeId, categoryId, status, search } = query;
    const where: FindOptionsWhere<ProductEntity> = {};

    if (storeId) where.storeId = storeId;
    if (categoryId) where.categoryId = categoryId;
    if (status !== undefined) where.status = status;
    if (search) where.name = Like(`%${search}%`);

    // Load relations on the list endpoint too — the merchant-hub Products
    // page needs variations, ingredients, and addon groups when opening the
    // edit sheet for a row. Without them the form fields show empty.
    const [data, total] = await this.productRepo.findAndCount({
      where,
      relations: [
        'variations',
        'productIngredients',
        'productIngredients.ingredient',
        'addonGroups',
        'addonGroups.addons',
      ],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const withNames = await this.attachCategoryNames(data);
    return paginate(withNames, total, page, limit, ProductResponseDto.from);
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const [entity] = await this.attachCategoryNames([await this.findEntity(id)]);
    return ProductResponseDto.from(entity);
  }

  private async findEntity(id: string): Promise<ProductEntity> {
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

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.findEntity(id);
    const { imageFileId, imageUrl, ...rest } = dto;
    Object.assign(product, rest);
    await this.resolveImageFields(product, { imageFileId, imageUrl });
    await this.productRepo.save(product);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findEntity(id);
    await this.productRepo.softDelete(id);
  }

  async toggleStatus(id: string, dto: ToggleProductStatusDto): Promise<ProductResponseDto> {
    const product = await this.findEntity(id);
    product.status = dto.status;
    await this.productRepo.save(product);
    return this.findOne(id);
  }

  async addVariation(productId: string, dto: CreateVariationDto): Promise<ProductVariationResponseDto> {
    await this.findEntity(productId);
    const variation = this.variationRepo.create({ ...dto, productId });
    const saved = await this.variationRepo.save(variation);
    return ProductVariationResponseDto.from(saved);
  }

  async updateVariation(
    productId: string,
    varId: string,
    dto: UpdateVariationDto,
  ): Promise<ProductVariationResponseDto> {
    const variation = await this.findVariation(productId, varId);
    Object.assign(variation, dto);
    const saved = await this.variationRepo.save(variation);
    return ProductVariationResponseDto.from(saved);
  }

  async removeVariation(productId: string, varId: string): Promise<void> {
    const variation = await this.findVariation(productId, varId);
    await this.variationRepo.remove(variation);
  }

  async linkIngredient(productId: string, dto: LinkIngredientDto): Promise<ProductIngredientResponseDto> {
    await this.findEntity(productId);
    const pi = this.productIngredientRepo.create({ ...dto, productId });
    const saved = await this.productIngredientRepo.save(pi);
    const reloaded = await this.productIngredientRepo.findOne({
      where: { id: saved.id },
      relations: ['ingredient'],
    });
    return ProductIngredientResponseDto.from(reloaded ?? saved);
  }

  async unlinkIngredient(productId: string, ingredientId: string): Promise<void> {
    const pi = await this.productIngredientRepo.findOne({
      where: { productId, ingredientId },
    });
    if (!pi) throw new NotFoundException(`Ingredient link not found`);
    await this.productIngredientRepo.remove(pi);
  }

  async linkAddonGroup(productId: string, groupId: string): Promise<ProductResponseDto> {
    const [product, group] = await Promise.all([
      this.findEntity(productId),
      this.addonGroupRepo.findOne({ where: { id: groupId } }),
    ]);
    if (!group) throw new NotFoundException(`Add-on group ${groupId} not found`);
    if (!product.addonGroups) product.addonGroups = [];
    if (!product.addonGroups.find((g) => g.id === groupId)) {
      product.addonGroups.push(group);
    }
    await this.productRepo.save(product);
    return this.findOne(productId);
  }

  async unlinkAddonGroup(productId: string, groupId: string): Promise<ProductResponseDto> {
    const product = await this.findEntity(productId);
    product.addonGroups = (product.addonGroups ?? []).filter((g) => g.id !== groupId);
    await this.productRepo.save(product);
    return this.findOne(productId);
  }

  private async findVariation(productId: string, varId: string): Promise<ProductVariationEntity> {
    const variation = await this.variationRepo.findOne({
      where: { id: varId, productId },
    });
    if (!variation) throw new NotFoundException(`Variation ${varId} not found`);
    return variation;
  }
}
