import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, FindOptionsWhere } from 'typeorm';
import { IngredientEntity } from './entities/ingredient.entity';
import { IngredientLocationStockEntity } from './entities/ingredient-location-stock.entity';
import { InventoryLocationEntity } from '../inventory-locations/entities/inventory-location.entity';
import {
  IngredientMovementEntity,
  MovementType,
} from './entities/ingredient-movement.entity';
import {
  CreateIngredientDto,
  InitialLocationStockDto,
} from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { IngredientResponseDto } from './dto/ingredient-response.dto';
import { MovementFilterDto, TransferStockDto } from './dto/movement-dto';
import { IngredientMovementResponseDto } from './dto/movement-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { endOfDayFilter, startOfDayFilter } from '../../common/utils/date-range';

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
    @InjectRepository(IngredientLocationStockEntity)
    private readonly locationStockRepo: Repository<IngredientLocationStockEntity>,
    @InjectRepository(InventoryLocationEntity)
    private readonly inventoryLocationRepo: Repository<InventoryLocationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Recomputes the ingredient's denormalized aggregate fields from its
   * per-location stock rows. Called whenever per-location stock changes so
   * legacy reads of `IngredientEntity.currentStock` / `minStock` stay correct
   * without us having to touch every consumer.
   *
   *  - `currentStock` = sum of per-location currentStock
   *  - `minStock`     = sum of per-location minStock
   *  - `expiryDate`   = earliest per-location expiry (or null if none)
   *
   * No-op when the ingredient has no location rows (legacy / single-location
   * ingredients keep their existing aggregate fields untouched).
   */
  private async recomputeAggregate(
    m: EntityManager,
    ingredientId: string,
  ): Promise<void> {
    const repo = m.getRepository(IngredientLocationStockEntity);
    const rows = await repo.find({ where: { ingredientId } });
    if (rows.length === 0) return;
    const sumStock = rows.reduce((a, r) => a + Number(r.currentStock), 0);
    const sumMin = rows.reduce((a, r) => a + Number(r.minStock), 0);
    const expiries = rows
      .map((r) => r.expiryDate)
      .filter((e): e is string => !!e)
      .sort();
    await m.getRepository(IngredientEntity).update(ingredientId, {
      currentStock: sumStock,
      minStock: sumMin,
      expiryDate: expiries.length > 0 ? expiries[0] : null,
    });
  }

  /** Hydrates a list of ingredients with their per-location stock rows in one
   * round-trip (IN query keyed by ingredient ids). */
  private async attachLocations(
    ingredients: IngredientEntity[],
  ): Promise<(IngredientEntity & { locations: IngredientLocationStockEntity[] })[]> {
    if (ingredients.length === 0) return [];
    const ids = ingredients.map((i) => i.id);
    const stocks = await this.locationStockRepo.find({
      where: ids.map((id) => ({ ingredientId: id })),
    });
    const byIngredient = new Map<string, IngredientLocationStockEntity[]>();
    for (const s of stocks) {
      const list = byIngredient.get(s.ingredientId) ?? [];
      list.push(s);
      byIngredient.set(s.ingredientId, list);
    }
    return ingredients.map((i) =>
      Object.assign(i, { locations: byIngredient.get(i.id) ?? [] }),
    );
  }

  async create(dto: CreateIngredientDto): Promise<IngredientResponseDto> {
    return this.dataSource.transaction(async (m) => {
      // Multi-supplier: keep the legacy single `supplierId` mirrored to the
      // first of `supplierIds` so any code still reading the old field stays
      // correct without a separate migration.
      const supplierIds = dto.supplierIds ?? (dto.supplierId ? [dto.supplierId] : []);
      const supplierId = supplierIds[0] ?? dto.supplierId ?? null;

      const ingredientRepo = m.getRepository(IngredientEntity);
      const ingredient = ingredientRepo.create({
        name: dto.name,
        unit: dto.unit,
        currentStock: dto.currentStock ?? 0,
        minStock: dto.minStock ?? 0,
        costPerUnit: dto.costPerUnit ?? 0,
        supplierId,
        supplierIds: supplierIds.length > 0 ? supplierIds : null,
        sku: dto.sku ?? null,
        type: dto.type ?? 'ingredient',
        storeId: dto.storeId,
        lastRestocked: dto.lastRestocked ? new Date(dto.lastRestocked) : null,
        expiryDate: dto.expiryDate ?? null,
      });
      const saved = await ingredientRepo.save(ingredient);

      if (dto.locations && dto.locations.length > 0) {
        const stockRepo = m.getRepository(IngredientLocationStockEntity);
        const rows = dto.locations.map((loc) =>
          stockRepo.create({
            ingredientId: saved.id,
            locationId: loc.locationId,
            storeId: dto.storeId,
            currentStock: loc.currentStock ?? 0,
            minStock: loc.minStock ?? 0,
            expiryDate: loc.expiryDate ?? null,
            lastRestocked: loc.currentStock && loc.currentStock > 0 ? new Date() : null,
          }),
        );
        await stockRepo.save(rows);
        await this.recomputeAggregate(m, saved.id);
      }

      const withLocations = await this.attachLocations([
        (await ingredientRepo.findOne({ where: { id: saved.id } }))!,
      ]);
      return IngredientResponseDto.from(withLocations[0]);
    });
  }

  async findAll(query: FilterIngredientDto): Promise<PaginatedResponseDto<IngredientResponseDto>> {
    const { page = 1, limit = 20, storeId, locationId, search, status, type } = query;

    const qb = this.ingredientRepo.createQueryBuilder('i');
    if (storeId) qb.andWhere('i.storeId = :storeId', { storeId });
    if (search) qb.andWhere('i.name ILIKE :search', { search: `%${search}%` });
    if (status === 'low') qb.andWhere('i.currentStock <= i.minStock');
    if (type) qb.andWhere('i.type = :type', { type });
    if (locationId) {
      // Only return ingredients with a stock entry at the selected location.
      // INNER JOIN keeps the pagination math correct vs a LEFT JOIN.
      qb.innerJoin(
        IngredientLocationStockEntity,
        'ls',
        'ls.ingredientId = i.id AND ls.locationId = :locationId',
        { locationId },
      );
    }

    qb.orderBy('i.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    const hydrated = await this.attachLocations(data);
    return paginate(hydrated, total, page, limit, IngredientResponseDto.from);
  }

  async findOne(id: string): Promise<IngredientResponseDto> {
    const ingredient = await this.findEntity(id);
    const [hydrated] = await this.attachLocations([ingredient]);
    return IngredientResponseDto.from(hydrated);
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
    // Keep the legacy single `supplierId` in lock-step with `supplierIds[0]`
    // whenever the caller updates the multi-supplier list.
    if (dto.supplierIds !== undefined) {
      ingredient.supplierIds = dto.supplierIds.length > 0 ? dto.supplierIds : null;
      ingredient.supplierId = dto.supplierIds[0] ?? null;
    } else if (dto.supplierId !== undefined) {
      ingredient.supplierId = dto.supplierId;
      ingredient.supplierIds = dto.supplierId ? [dto.supplierId] : null;
    }
    // Apply the rest of the patch (skip the supplier fields we just handled
    // and the `locations` field which has its own endpoint).
    const { supplierId: _s1, supplierIds: _s2, locations: _s3, ...rest } = dto;
    void _s1;
    void _s2;
    void _s3;
    Object.assign(ingredient, rest);
    const saved = await this.ingredientRepo.save(ingredient);
    const [hydrated] = await this.attachLocations([saved]);
    return IngredientResponseDto.from(hydrated);
  }

  /** Lists per-location stock for an ingredient. */
  async listLocationStocks(ingredientId: string) {
    await this.findEntity(ingredientId);
    return this.locationStockRepo.find({
      where: { ingredientId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Upserts the per-location stock row for an ingredient × location pair.
   * Recomputes the ingredient's aggregate fields after the write.
   */
  async setLocationStock(
    ingredientId: string,
    locationId: string,
    dto: Partial<InitialLocationStockDto>,
  ): Promise<IngredientResponseDto> {
    const ingredient = await this.findEntity(ingredientId);
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(IngredientLocationStockEntity);
      let row = await repo.findOne({
        where: { ingredientId, locationId },
      });
      if (!row) {
        row = repo.create({
          ingredientId,
          locationId,
          storeId: ingredient.storeId,
          currentStock: 0,
          minStock: 0,
        });
      }
      if (dto.currentStock !== undefined) row.currentStock = dto.currentStock;
      if (dto.minStock !== undefined) row.minStock = dto.minStock;
      if (dto.expiryDate !== undefined) row.expiryDate = dto.expiryDate ?? null;
      await repo.save(row);
      await this.recomputeAggregate(m, ingredientId);
    });
    return this.findOne(ingredientId);
  }

  /** Removes a per-location stock row and recomputes the aggregate. */
  async removeLocationStock(
    ingredientId: string,
    locationId: string,
  ): Promise<void> {
    await this.findEntity(ingredientId);
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(IngredientLocationStockEntity).delete({
        ingredientId,
        locationId,
      });
      await this.recomputeAggregate(m, ingredientId);
    });
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
    await this.dataSource.transaction(async (m) => {
      const ingredientRepo = m.getRepository(IngredientEntity);
      const stockRepo = m.getRepository(IngredientLocationStockEntity);
      const ingredient = await ingredientRepo.findOne({ where: { id } });
      if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);

      // Pick the target location: caller-specified, or the only location if
      // the ingredient has exactly one. Legacy ingredients with no location
      // rows fall through to direct aggregate adjustment (back-compat).
      // `location` is joined so the movement row can name where the adjustment
      // landed (and whether it's an in-store or out-store location).
      const locationRows = await stockRepo.find({
        where: { ingredientId: id },
        relations: ['location'],
      });
      let targetRow: IngredientLocationStockEntity | null = null;
      if (locationRows.length > 0) {
        if (dto.locationId) {
          targetRow = locationRows.find((r) => r.locationId === dto.locationId) ?? null;
          if (!targetRow) {
            throw new BadRequestException(
              `Ingredient is not stocked at location ${dto.locationId}`,
            );
          }
        } else if (locationRows.length === 1) {
          targetRow = locationRows[0];
        } else {
          throw new BadRequestException(
            'This ingredient is stocked at multiple locations — specify `locationId`.',
          );
        }
      }

      let previous: number;
      let next: number;
      if (targetRow) {
        previous = Number(targetRow.currentStock);
        next = previous + dto.adjustment;
        targetRow.currentStock = next;
        if (dto.adjustment > 0) targetRow.lastRestocked = new Date();
        if (dto.adjustment > 0 && dto.expiryDate) {
          targetRow.expiryDate = dto.expiryDate;
        }
        await stockRepo.save(targetRow);
        await this.recomputeAggregate(m, id);
      } else {
        // Legacy path — no per-location rows. Adjust the aggregate directly
        // so existing ingredients (and their consumers) keep working until
        // the merchant migrates them onto the multi-location model.
        previous = Number(ingredient.currentStock);
        next = previous + dto.adjustment;
        ingredient.currentStock = next;
        if (dto.adjustment > 0) ingredient.lastRestocked = new Date();
        if (dto.adjustment > 0 && dto.expiryDate) {
          ingredient.expiryDate = dto.expiryDate;
        }
        await ingredientRepo.save(ingredient);
      }

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
          // When the adjustment landed on a specific location row, name it and
          // report that location's own figures — "was 10 → now 15" is
          // ambiguous for an ingredient stocked in several places.
          locationId: targetRow?.locationId ?? null,
          locationName: targetRow?.location?.name ?? null,
          locationType: targetRow?.location?.type ?? null,
          locationPreviousStock: targetRow ? previous : null,
          locationNewStock: targetRow ? next : null,
          reason: dto.reason ?? null,
        }),
      );
    });

    return this.findOne(id);
  }

  /**
   * Atomically moves stock for one ingredient between two of its locations.
   * Used by the stock-transfers module when a transfer is received so the
   * source location is debited and the destination credited. Aggregates are
   * unchanged (sum is preserved) but the per-location split shifts.
   *
   * Can be invoked inside an existing transaction (`txManager`) so a transfer
   * receipt + per-line credit/debit can roll back together.
   */
  async transferBetweenLocations(
    ingredientId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    txManager?: EntityManager,
    /** Receives the destination row's before/after so the caller's movement
     *  row can report the location's own figures rather than the total. */
    onReceived?: (before: number, after: number) => void,
  ): Promise<void> {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');
    if (fromLocationId === toLocationId) {
      throw new BadRequestException('Source and destination locations must differ');
    }
    const run = async (m: EntityManager) => {
      const stockRepo = m.getRepository(IngredientLocationStockEntity);
      const fromRow = await stockRepo.findOne({
        where: { ingredientId, locationId: fromLocationId },
      });
      if (!fromRow) {
        throw new BadRequestException(
          `Ingredient ${ingredientId} has no stock at location ${fromLocationId}`,
        );
      }
      if (Number(fromRow.currentStock) < quantity) {
        throw new BadRequestException('Insufficient stock at source location');
      }
      let toRow = await stockRepo.findOne({
        where: { ingredientId, locationId: toLocationId },
      });
      if (!toRow) {
        toRow = stockRepo.create({
          ingredientId,
          locationId: toLocationId,
          storeId: fromRow.storeId,
          currentStock: 0,
          minStock: 0,
        });
      }
      const toBefore = Number(toRow.currentStock);
      fromRow.currentStock = Number(fromRow.currentStock) - quantity;
      toRow.currentStock = toBefore + quantity;
      toRow.lastRestocked = new Date();
      onReceived?.(toBefore, toBefore + quantity);
      await stockRepo.save([fromRow, toRow]);
      // Aggregate sum is preserved by definition; still recompute so the
      // earliest-expiry rollup stays in sync.
      await this.recomputeAggregate(m, ingredientId);
    };
    if (txManager) await run(txManager);
    else await this.dataSource.transaction(run);
  }

  /**
   * Staff-facing location-to-location transfer for one ingredient. The
   * destination doesn't need to stock the item yet — transferBetweenLocations
   * auto-creates the destination stock row, which is exactly how an item
   * becomes available at a new location (client spec: transfers are how items
   * come to exist in multiple locations). Moves the stock and records a
   * TRANSFER movement naming the sending and receiving locations so the
   * movement log shows both.
   */
  async transferToLocation(
    actor: ActorContext,
    ingredientId: string,
    dto: {
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      reason?: string;
    },
  ): Promise<void> {
    const ingredient = await this.ingredientRepo.findOne({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${ingredientId} not found`);
    }
    const [fromLoc, toLoc] = await Promise.all([
      this.inventoryLocationRepo.findOne({ where: { id: dto.fromLocationId } }),
      this.inventoryLocationRepo.findOne({ where: { id: dto.toLocationId } }),
    ]);
    if (!fromLoc || !toLoc) {
      throw new NotFoundException('Source or destination location not found');
    }
    // Both ends must belong to the ingredient's store — a transfer can't move
    // stock across stores.
    if (
      fromLoc.storeId !== ingredient.storeId ||
      toLoc.storeId !== ingredient.storeId
    ) {
      throw new BadRequestException(
        'Source and destination locations must belong to this store',
      );
    }

    await this.dataSource.transaction(async (m) => {
      let received: { before: number; after: number } | null = null;
      await this.transferBetweenLocations(
        ingredientId,
        dto.fromLocationId,
        dto.toLocationId,
        dto.quantity,
        m,
        (before, after) => {
          received = { before, after };
        },
      );
      const ing = await m
        .getRepository(IngredientEntity)
        .findOne({ where: { id: ingredientId } });
      await m.save(
        m.create(IngredientMovementEntity, {
          ingredientId,
          storeId: ing?.storeId ?? '',
          staffId: actor.sub_type === 'staff' ? actor.sub : null,
          staffName: actor.actorName ?? null,
          type: MovementType.TRANSFER,
          quantity: dto.quantity,
          previousStock: Number(ing?.currentStock ?? 0),
          newStock: Number(ing?.currentStock ?? 0),
          reason:
            dto.reason ??
            `Transfer from ${fromLoc?.name ?? dto.fromLocationId} to ${toLoc?.name ?? dto.toLocationId}`,
          referenceType: 'location_transfer',
          referenceId: dto.toLocationId,
          fromLocationName: fromLoc?.name ?? null,
          toLocationName: toLoc?.name ?? null,
          // The history line reads against the receiving location, which is
          // what the merchant is actually looking at when they open it.
          locationId: dto.toLocationId,
          locationName: toLoc?.name ?? null,
          locationType: toLoc?.type ?? null,
          locationPreviousStock:
            (received as { before: number } | null)?.before ?? null,
          locationNewStock:
            (received as { after: number } | null)?.after ?? null,
        }),
      );
    });
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
    if (filter.dateFrom) qb.andWhere('m.createdAt >= :df', { df: startOfDayFilter(filter.dateFrom) });
    if (filter.dateTo) qb.andWhere('m.createdAt <= :dt', { dt: endOfDayFilter(filter.dateTo) });

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
