import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariationEntity } from './entities/product-variation.entity';
import { ProductIngredientEntity } from './entities/product-ingredient.entity';
import { AddOnGroupEntity } from '../addon-groups/entities/addon-group.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import {
  CreateProductDto,
  CreateProductIngredientDto,
  CreateVariationDto,
} from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateVariationDto,
  SyncVariationsDto,
  ToggleProductStatusDto,
} from './dto/update-product.dto';
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

  /**
   * Rewrites a product's whole recipe to exactly the rows given, resolving
   * each row's variation scope. A row may name its variation instead of
   * carrying its id (the create flow, where variations get their ids only on
   * save); an unmatched name degrades to the product-level default rather
   * than being dropped. Replace-all semantics also fix the duplicate rows the
   * old per-link endpoint could leave behind, which double-deducted stock.
   */
  private async replaceIngredients(
    productId: string,
    ingredients: CreateProductIngredientDto[],
  ): Promise<void> {
    await this.productIngredientRepo.delete({ productId });
    if (!ingredients.length) return;

    const variations = await this.variationRepo.find({ where: { productId } });
    const byName = new Map(
      variations.map((v) => [v.name.trim().toLowerCase(), v.id]),
    );
    const validIds = new Set(variations.map((v) => v.id));

    const rows = ingredients.map((i) => {
      const { variationId, variationName, ...rest } = i;
      let scope: string | null = null;
      if (variationId && validIds.has(variationId)) {
        scope = variationId;
      } else if (variationName) {
        scope = byName.get(variationName.trim().toLowerCase()) ?? null;
      }
      return this.productIngredientRepo.create({
        ...rest,
        productId,
        variationId: scope,
      } as Partial<ProductIngredientEntity>);
    });
    await this.productIngredientRepo.save(rows);
  }

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const { variations, ingredients, addonGroupIds, imageFileId, imageUrl, ...productData } = dto;
    const product = this.productRepo.create(productData);
    await this.resolveImageFields(product, { imageFileId, imageUrl });

    if (variations?.length) {
      product.variations = variations.map((v) => this.variationRepo.create(v));
    }

    if (addonGroupIds?.length) {
      product.addonGroups = await this.addonGroupRepo.findBy({
        id: In(addonGroupIds),
      });
    }

    const saved = await this.productRepo.save(product);

    // After save, so variation-scoped recipe lines can bind to real ids.
    if (ingredients?.length) {
      await this.replaceIngredients(saved.id, ingredients);
    }

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
    const { imageFileId, imageUrl, ingredients, addonGroupIds, ...rest } = dto;
    Object.assign(product, rest);
    await this.resolveImageFields(product, { imageFileId, imageUrl });

    if (addonGroupIds !== undefined) {
      product.addonGroups = addonGroupIds.length
        ? await this.addonGroupRepo.findBy({ id: In(addonGroupIds) })
        : [];
    }

    // Hide the recipe collection from the cascade entirely: replaceIngredients
    // owns those rows. Leaving the loaded set attached would re-insert the
    // stale recipe after we replace it, and emptying the array makes TypeORM
    // orphan the rows by nulling their (NOT NULL) productId.
    delete (product as Partial<ProductEntity>).productIngredients;
    await this.productRepo.save(product);

    if (ingredients !== undefined) {
      await this.replaceIngredients(id, ingredients);
    }

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

  /**
   * Makes a product's variations exactly match the supplied set, in one
   * transaction: rows carrying an `id` are updated in place, rows without one
   * are inserted, and existing rows absent from the list are removed.
   *
   * Updating in place matters — deleting and recreating would cascade away each
   * variation's ingredient recipe (`product_ingredients.variationId` is ON
   * DELETE CASCADE), silently wiping the merchant's per-variant stock links.
   */
  async syncVariations(
    productId: string,
    dto: SyncVariationsDto,
  ): Promise<ProductVariationResponseDto[]> {
    await this.findEntity(productId);

    return this.productRepo.manager.transaction(async (m) => {
      const repo = m.getRepository(ProductVariationEntity);
      const existing = await repo.find({ where: { productId } });
      const existingById = new Map(existing.map((v) => [v.id, v]));

      const keptIds = new Set<string>();
      const result: ProductVariationEntity[] = [];

      for (const row of dto.variations) {
        const { id, ...fields } = row;
        const current = id ? existingById.get(id) : undefined;
        if (current) {
          Object.assign(current, fields);
          result.push(await repo.save(current));
          keptIds.add(current.id);
        } else {
          // An unknown id is treated as a new variation rather than an error:
          // the form may be re-saving against a variation deleted elsewhere.
          result.push(await repo.save(repo.create({ ...fields, productId })));
        }
      }

      const removed = existing.filter((v) => !keptIds.has(v.id));
      if (removed.length > 0) await repo.remove(removed);

      return result.map(ProductVariationResponseDto.from);
    });
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
