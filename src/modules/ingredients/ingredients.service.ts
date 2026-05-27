import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, FindOptionsWhere } from 'typeorm';
import { IngredientEntity } from './entities/ingredient.entity';
import {
  IngredientMovementEntity,
  MovementType,
} from './entities/ingredient-movement.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { IngredientResponseDto } from './dto/ingredient-response.dto';
import { MovementFilterDto, TransferStockDto } from './dto/movement-dto';
import { IngredientMovementResponseDto } from './dto/movement-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

interface ActorContext {
  sub: string;
  sub_type: 'admin' | 'staff';
  businessId: string;
  storeId?: string;
  actorName?: string;
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(IngredientEntity)
    private readonly ingredientRepo: Repository<IngredientEntity>,
    @InjectRepository(IngredientMovementEntity)
    private readonly movementRepo: Repository<IngredientMovementEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateIngredientDto): Promise<IngredientResponseDto> {
    const ingredient = this.ingredientRepo.create(dto);
    const saved = await this.ingredientRepo.save(ingredient);
    return IngredientResponseDto.from(saved);
  }

  async findAll(query: FilterIngredientDto): Promise<PaginatedResponseDto<IngredientResponseDto>> {
    const { page = 1, limit = 20, storeId, search, status } = query;

    const qb = this.ingredientRepo.createQueryBuilder('i');
    if (storeId) qb.andWhere('i.storeId = :storeId', { storeId });
    if (search) qb.andWhere('i.name ILIKE :search', { search: `%${search}%` });
    if (status === 'low') qb.andWhere('i.currentStock <= i.minStock');

    qb.orderBy('i.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, IngredientResponseDto.from);
  }

  async findOne(id: string): Promise<IngredientResponseDto> {
    return IngredientResponseDto.from(await this.findEntity(id));
  }

  private async findEntity(id: string): Promise<IngredientEntity> {
    const ingredient = await this.ingredientRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);
    return ingredient;
  }

  /**
   * Returns ingredients whose `expiryDate` is on or before `today + days`,
   * sorted by soonest expiry. Excludes ingredients with no expiry recorded.
   * The workstation Inventory Alerts card reads this to flag batches that
   * need attention before they spoil.
   */
  async findExpiring(
    storeId: string | undefined,
    days: number,
  ): Promise<IngredientResponseDto[]> {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    // 'date' columns compare as ISO date strings in Postgres — emit YYYY-MM-DD.
    const horizonIso = horizon.toISOString().slice(0, 10);

    const qb = this.ingredientRepo
      .createQueryBuilder('i')
      .where('i.expiryDate IS NOT NULL')
      .andWhere('i.expiryDate <= :horizon', { horizon: horizonIso })
      .orderBy('i.expiryDate', 'ASC');
    if (storeId) qb.andWhere('i.storeId = :storeId', { storeId });

    const rows = await qb.getMany();
    return rows.map(IngredientResponseDto.from);
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

  async update(id: string, dto: UpdateIngredientDto): Promise<IngredientResponseDto> {
    const ingredient = await this.findEntity(id);
    Object.assign(ingredient, dto);
    const saved = await this.ingredientRepo.save(ingredient);
    return IngredientResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findEntity(id);
    await this.ingredientRepo.softDelete(id);
  }

  /**
   * Adjusts stock for an ingredient and writes an append-only movement row.
   * Auto-classifies type by sign when not provided: positive → INTAKE,
   * negative → CORRECTION (use `recordWaste` or `recordConsumption` for
   * those specific cases). All updates run in a single transaction.
   */
  async adjustStock(
    actor: ActorContext | null,
    id: string,
    dto: AdjustStockDto & { type?: MovementType },
  ): Promise<IngredientResponseDto> {
    const saved = await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(IngredientEntity);
      const ingredient = await repo.findOne({ where: { id } });
      if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);

      const previous = Number(ingredient.currentStock);
      const next = previous + dto.adjustment;
      ingredient.currentStock = next;
      if (dto.adjustment > 0) ingredient.lastRestocked = new Date();
      // Receiving new stock can refresh the best-before date for the batch.
      // We intentionally only honour expiryDate on intake (positive adjustment)
      // to avoid silently rewriting expiry from waste/correction flows.
      if (dto.adjustment > 0 && dto.expiryDate) {
        ingredient.expiryDate = dto.expiryDate;
      }
      const after = await repo.save(ingredient);

      const movementType =
        dto.type ??
        (dto.adjustment > 0 ? MovementType.INTAKE : MovementType.CORRECTION);

      await m.save(
        m.create(IngredientMovementEntity, {
          ingredientId: ingredient.id,
          storeId: ingredient.storeId,
          staffId: actor?.sub ?? null,
          staffName: actor?.actorName ?? null,
          type: movementType,
          quantity: dto.adjustment,
          previousStock: previous,
          newStock: next,
          reason: dto.reason ?? null,
        }),
      );

      return after;
    });

    return IngredientResponseDto.from(saved);
  }

  /**
   * Records consumption against an ingredient — used by the orders module on
   * order completion. Can be invoked inside an existing transaction (pass
   * `txManager`) or on its own.
   */
  async recordConsumption(
    ingredientId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    actor: ActorContext | null,
    txManager?: EntityManager,
  ): Promise<void> {
    const run = async (m: EntityManager) => {
      const repo = m.getRepository(IngredientEntity);
      const ingredient = await repo.findOne({ where: { id: ingredientId } });
      if (!ingredient) return;
      const previous = Number(ingredient.currentStock);
      const next = previous - quantity;
      ingredient.currentStock = next;
      await repo.save(ingredient);

      await m.save(
        m.create(IngredientMovementEntity, {
          ingredientId: ingredient.id,
          storeId: ingredient.storeId,
          staffId: actor?.sub ?? null,
          staffName: actor?.actorName ?? null,
          type: MovementType.CONSUMPTION,
          quantity: -quantity,
          previousStock: previous,
          newStock: next,
          referenceType,
          referenceId,
        }),
      );
    };

    if (txManager) {
      await run(txManager);
    } else {
      await this.dataSource.transaction(run);
    }
  }

  async transfer(
    actor: ActorContext,
    fromId: string,
    dto: TransferStockDto,
  ): Promise<{
    from: IngredientResponseDto;
    to: IngredientResponseDto;
  }> {
    if (fromId === dto.toIngredientId) {
      throw new BadRequestException('Source and destination must differ');
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const result = await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(IngredientEntity);
      const from = await repo.findOne({ where: { id: fromId } });
      const to = await repo.findOne({ where: { id: dto.toIngredientId } });
      if (!from) throw new NotFoundException(`Ingredient ${fromId} not found`);
      if (!to) throw new NotFoundException(`Ingredient ${dto.toIngredientId} not found`);
      if (Number(from.currentStock) < dto.quantity) {
        throw new BadRequestException('Insufficient stock at source');
      }
      if (
        actor.sub_type === 'staff' &&
        actor.storeId &&
        (from.storeId !== actor.storeId || to.storeId !== actor.storeId)
      ) {
        throw new ForbiddenException('Both ingredients must belong to your store');
      }

      const fromPrev = Number(from.currentStock);
      const toPrev = Number(to.currentStock);
      const fromNext = fromPrev - dto.quantity;
      const toNext = toPrev + dto.quantity;

      from.currentStock = fromNext;
      to.currentStock = toNext;
      await repo.save([from, to]);

      const outRow = m.create(IngredientMovementEntity, {
        ingredientId: from.id,
        storeId: from.storeId,
        staffId: actor.sub,
        staffName: actor.actorName ?? null,
        type: MovementType.TRANSFER,
        quantity: -dto.quantity,
        previousStock: fromPrev,
        newStock: fromNext,
        reason: dto.reason ?? null,
        referenceType: 'transfer',
        referenceId: to.id,
      });
      const inRow = m.create(IngredientMovementEntity, {
        ingredientId: to.id,
        storeId: to.storeId,
        staffId: actor.sub,
        staffName: actor.actorName ?? null,
        type: MovementType.TRANSFER,
        quantity: dto.quantity,
        previousStock: toPrev,
        newStock: toNext,
        reason: dto.reason ?? null,
        referenceType: 'transfer',
        referenceId: from.id,
      });
      await m.save([outRow, inRow]);

      return { from, to };
    });

    return {
      from: IngredientResponseDto.from(result.from),
      to: IngredientResponseDto.from(result.to),
    };
  }

  async listMovements(
    actor: ActorContext,
    filter: MovementFilterDto,
  ): Promise<PaginatedResponseDto<IngredientMovementResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.ingredient', 'ingredient')
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.storeId) qb.andWhere('m.storeId = :storeId', { storeId: filter.storeId });
    if (actor.sub_type === 'staff' && actor.storeId) {
      qb.andWhere('m.storeId = :scopedStore', { scopedStore: actor.storeId });
    }
    if (filter.ingredientId) qb.andWhere('m.ingredientId = :iid', { iid: filter.ingredientId });
    if (filter.type) qb.andWhere('m.type = :type', { type: filter.type });
    if (filter.dateFrom) qb.andWhere('m.createdAt >= :df', { df: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('m.createdAt <= :dt', { dt: `${filter.dateTo} 23:59:59` });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, IngredientMovementResponseDto.from);
  }

  async listMovementsForIngredient(
    actor: ActorContext,
    ingredientId: string,
    filter: MovementFilterDto,
  ): Promise<PaginatedResponseDto<IngredientMovementResponseDto>> {
    return this.listMovements(actor, { ...filter, ingredientId });
  }
}
