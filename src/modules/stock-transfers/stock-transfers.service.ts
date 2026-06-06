import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  StockTransferEntity,
  StockTransferStatus,
} from './entities/stock-transfer.entity';
import { StockTransferItemEntity } from './entities/stock-transfer-item.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import { IngredientLocationStockEntity } from '../ingredients/entities/ingredient-location-stock.entity';
import { InventoryLocationEntity } from '../inventory-locations/entities/inventory-location.entity';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  StockTransferFilterDto,
  UpdateStockTransferDto,
} from './dto/stock-transfer.dto';
import { StockTransferResponseDto } from './dto/stock-transfer-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';

@Injectable()
export class StockTransfersService {
  constructor(
    @InjectRepository(StockTransferEntity)
    private readonly transferRepo: Repository<StockTransferEntity>,
    @InjectRepository(StockTransferItemEntity)
    private readonly itemRepo: Repository<StockTransferItemEntity>,
    @InjectRepository(IngredientEntity)
    private readonly ingredientRepo: Repository<IngredientEntity>,
    @InjectRepository(IngredientLocationStockEntity)
    private readonly locationStockRepo: Repository<IngredientLocationStockEntity>,
    @InjectRepository(InventoryLocationEntity)
    private readonly locationRepo: Repository<InventoryLocationEntity>,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Upserts a per-location stock row with a delta. Returns the row. */
  private async applyLocationDelta(
    mgr: import('typeorm').EntityManager,
    ingredientId: string,
    locationId: string,
    storeId: string,
    delta: number,
    opts: { markRestocked?: boolean } = {},
  ): Promise<IngredientLocationStockEntity> {
    const repo = mgr.getRepository(IngredientLocationStockEntity);
    let row = await repo.findOne({ where: { ingredientId, locationId } });
    if (!row) {
      row = repo.create({
        ingredientId,
        locationId,
        storeId,
        currentStock: 0,
        minStock: 0,
      });
    }
    row.currentStock = Number(row.currentStock) + delta;
    if (opts.markRestocked) row.lastRestocked = new Date();
    return repo.save(row);
  }

  async findAll(
    filter: StockTransferFilterDto,
  ): Promise<PaginatedResponseDto<StockTransferResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.items', 'items')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('t.createdAt', 'DESC');

    if (filter.storeId)
      qb.andWhere('t.storeId = :storeId', { storeId: filter.storeId });
    if (filter.status) qb.andWhere('t.status = :status', { status: filter.status });
    if (filter.fromLocationId)
      qb.andWhere('t.fromLocationId = :from', { from: filter.fromLocationId });
    if (filter.toLocationId)
      qb.andWhere('t.toLocationId = :to', { to: filter.toLocationId });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, StockTransferResponseDto.from);
  }

  async findOne(id: string): Promise<StockTransferResponseDto> {
    const t = await this.transferRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!t) throw new NotFoundException('Stock transfer not found');
    return StockTransferResponseDto.from(t);
  }

  async create(
    actor: AdminJwtPayload,
    dto: CreateStockTransferDto,
  ): Promise<StockTransferResponseDto> {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException(
        'Source and destination must differ',
      );
    }

    // Validate locations belong to the store
    const [fromLoc, toLoc] = await Promise.all([
      this.locationRepo.findOne({ where: { id: dto.fromLocationId } }),
      this.locationRepo.findOne({ where: { id: dto.toLocationId } }),
    ]);
    if (!fromLoc || fromLoc.storeId !== dto.storeId)
      throw new NotFoundException('Source location not found');
    if (!toLoc || toLoc.storeId !== dto.storeId)
      throw new NotFoundException('Destination location not found');

    // Snapshot ingredient name/unit/cost into the line item
    const ingredients = await this.ingredientRepo.find({
      where: dto.items.map((i) => ({ id: i.ingredientId })),
    });
    const map = new Map(ingredients.map((i) => [i.id, i]));

    for (const item of dto.items) {
      if (!map.has(item.ingredientId)) {
        throw new NotFoundException(`Ingredient ${item.ingredientId} not found`);
      }
    }

    const transfer = this.transferRepo.create({
      storeId: dto.storeId,
      fromLocationId: dto.fromLocationId,
      toLocationId: dto.toLocationId,
      status: StockTransferStatus.PENDING,
      requestedById: actor.sub,
      requestedByName: actor.email,
      notes: dto.notes ?? null,
      items: dto.items.map((i) => {
        const ing = map.get(i.ingredientId)!;
        return this.itemRepo.create({
          ingredientId: i.ingredientId,
          name: ing.name,
          unit: ing.unit,
          quantity: i.quantity,
          unitCost: Number(ing.costPerUnit),
        });
      }),
    });

    const saved = await this.transferRepo.save(transfer);

    this.activityLog.record({
      actorType: 'admin',
      actorId: actor.sub,
      actorName: actor.email,
      action: 'stock_transfer.created',
      businessId: actor.businessId,
      storeId: dto.storeId,
      resourceType: 'stock_transfer',
      resourceId: saved.id,
      metadata: { itemCount: dto.items.length },
    });

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateStockTransferDto,
  ): Promise<StockTransferResponseDto> {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    if (transfer.status !== StockTransferStatus.PENDING) {
      throw new BadRequestException(
        `Only pending transfers can be edited (status: ${transfer.status})`,
      );
    }

    if (dto.notes !== undefined) transfer.notes = dto.notes ?? null;
    if (dto.fromLocationId) transfer.fromLocationId = dto.fromLocationId;
    if (dto.toLocationId) transfer.toLocationId = dto.toLocationId;

    if (dto.items) {
      // Replace items
      await this.itemRepo.delete({ transferId: id });
      const ingredients = await this.ingredientRepo.find({
        where: dto.items.map((i) => ({ id: i.ingredientId })),
      });
      const map = new Map(ingredients.map((i) => [i.id, i]));
      transfer.items = dto.items.map((i) => {
        const ing = map.get(i.ingredientId);
        if (!ing) throw new NotFoundException(`Ingredient ${i.ingredientId} not found`);
        return this.itemRepo.create({
          transferId: id,
          ingredientId: i.ingredientId,
          name: ing.name,
          unit: ing.unit,
          quantity: i.quantity,
          unitCost: Number(ing.costPerUnit),
        });
      });
    }

    await this.transferRepo.save(transfer);
    return this.findOne(id);
  }

  async approve(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<StockTransferResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const transfer = await mgr.getRepository(StockTransferEntity).findOne({
        where: { id },
        relations: ['items'],
      });
      if (!transfer) throw new NotFoundException('Stock transfer not found');
      if (transfer.status !== StockTransferStatus.PENDING) {
        throw new BadRequestException(
          `Only pending transfers can be approved (status: ${transfer.status})`,
        );
      }

      // Debit source-location stock per item. Ingredients managed per-location
      // adjust the source row; legacy ingredients (no location rows yet) fall
      // back to the aggregate IngredientEntity.currentStock for back-compat.
      for (const item of transfer.items) {
        const ing = await mgr.getRepository(IngredientEntity).findOne({
          where: { id: item.ingredientId },
        });
        if (!ing) throw new NotFoundException(`Ingredient ${item.ingredientId} not found`);
        const locationRows = await mgr.getRepository(IngredientLocationStockEntity).find({
          where: { ingredientId: item.ingredientId },
        });
        const qty = Number(item.quantity);

        if (locationRows.length > 0) {
          const fromRow = locationRows.find(
            (r) => r.locationId === transfer.fromLocationId,
          );
          if (!fromRow) {
            throw new BadRequestException(
              `${ing.name} has no stock at the source location`,
            );
          }
          if (Number(fromRow.currentStock) < qty) {
            throw new BadRequestException(
              `Insufficient stock for ${ing.name} at source: have ${fromRow.currentStock}, need ${qty}`,
            );
          }
          await this.applyLocationDelta(
            mgr,
            item.ingredientId,
            transfer.fromLocationId,
            transfer.storeId,
            -qty,
          );
        } else {
          if (Number(ing.currentStock) < qty) {
            throw new BadRequestException(
              `Insufficient stock for ${ing.name}: have ${ing.currentStock}, need ${qty}`,
            );
          }
        }
        // Keep the denormalized aggregate in sync with the sum-of-locations
        // invariant (legacy path adjusts the same field directly).
        ing.currentStock = Number(ing.currentStock) - qty;
        await mgr.getRepository(IngredientEntity).save(ing);
      }

      transfer.status = StockTransferStatus.IN_TRANSIT;
      transfer.approvedById = actor.sub;
      transfer.approvedAt = new Date();
      await mgr.getRepository(StockTransferEntity).save(transfer);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email,
        action: 'stock_transfer.approved',
        businessId: actor.businessId,
        storeId: transfer.storeId,
        resourceType: 'stock_transfer',
        resourceId: id,
      });

      return StockTransferResponseDto.from(transfer);
    });
  }

  async receive(
    actor: AdminJwtPayload,
    id: string,
    dto: ReceiveStockTransferDto,
  ): Promise<StockTransferResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const transfer = await mgr.getRepository(StockTransferEntity).findOne({
        where: { id },
        relations: ['items'],
      });
      if (!transfer) throw new NotFoundException('Stock transfer not found');
      if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new BadRequestException(
          `Only in-transit transfers can be received (status: ${transfer.status})`,
        );
      }

      const itemMap = new Map(transfer.items.map((i) => [i.id, i]));
      for (const line of dto.items) {
        const item = itemMap.get(line.itemId);
        if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);
        if (line.receivedQuantity > Number(item.quantity)) {
          throw new BadRequestException(
            `Received quantity exceeds shipped for ${item.name}`,
          );
        }
        item.receivedQuantity = line.receivedQuantity;
        await mgr.getRepository(StockTransferItemEntity).save(item);

        const ing = await mgr.getRepository(IngredientEntity).findOne({
          where: { id: item.ingredientId },
        });
        if (!ing) continue;
        const locationRows = await mgr.getRepository(IngredientLocationStockEntity).find({
          where: { ingredientId: item.ingredientId },
        });

        if (locationRows.length > 0) {
          // Credit (or create) the destination location's stock row.
          await this.applyLocationDelta(
            mgr,
            item.ingredientId,
            transfer.toLocationId,
            transfer.storeId,
            line.receivedQuantity,
            { markRestocked: true },
          );
        }
        // Aggregate sync (per-location flow keeps it equal to sum-of-locations;
        // legacy flow updates the field directly).
        ing.currentStock = Number(ing.currentStock) + line.receivedQuantity;
        ing.lastRestocked = new Date();
        await mgr.getRepository(IngredientEntity).save(ing);
      }

      transfer.status = StockTransferStatus.RECEIVED;
      transfer.receivedById = actor.sub;
      transfer.receivedAt = new Date();
      await mgr.getRepository(StockTransferEntity).save(transfer);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email,
        action: 'stock_transfer.received',
        businessId: actor.businessId,
        storeId: transfer.storeId,
        resourceType: 'stock_transfer',
        resourceId: id,
      });

      return StockTransferResponseDto.from(transfer);
    });
  }

  async cancel(
    actor: AdminJwtPayload,
    id: string,
  ): Promise<StockTransferResponseDto> {
    return this.dataSource.transaction(async (mgr) => {
      const transfer = await mgr.getRepository(StockTransferEntity).findOne({
        where: { id },
        relations: ['items'],
      });
      if (!transfer) throw new NotFoundException('Stock transfer not found');
      if (
        transfer.status === StockTransferStatus.RECEIVED ||
        transfer.status === StockTransferStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot cancel a ${transfer.status} transfer`,
        );
      }

      // If approved/in-transit, restore source-location stock so the cancel
      // unwinds the approval cleanly.
      if (transfer.status === StockTransferStatus.IN_TRANSIT) {
        for (const item of transfer.items) {
          const ing = await mgr.getRepository(IngredientEntity).findOne({
            where: { id: item.ingredientId },
          });
          if (!ing) continue;
          const locationRows = await mgr.getRepository(IngredientLocationStockEntity).find({
            where: { ingredientId: item.ingredientId },
          });
          if (locationRows.length > 0) {
            await this.applyLocationDelta(
              mgr,
              item.ingredientId,
              transfer.fromLocationId,
              transfer.storeId,
              Number(item.quantity),
            );
          }
          ing.currentStock = Number(ing.currentStock) + Number(item.quantity);
          await mgr.getRepository(IngredientEntity).save(ing);
        }
      }

      transfer.status = StockTransferStatus.CANCELLED;
      await mgr.getRepository(StockTransferEntity).save(transfer);

      this.activityLog.record({
        actorType: 'admin',
        actorId: actor.sub,
        actorName: actor.email,
        action: 'stock_transfer.cancelled',
        businessId: actor.businessId,
        storeId: transfer.storeId,
        resourceType: 'stock_transfer',
        resourceId: id,
      });

      return StockTransferResponseDto.from(transfer);
    });
  }

  async remove(id: string): Promise<void> {
    const transfer = await this.transferRepo.findOne({ where: { id } });
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    if (transfer.status !== StockTransferStatus.PENDING) {
      throw new BadRequestException(
        'Only pending transfers can be deleted; cancel instead',
      );
    }
    await this.transferRepo.softRemove(transfer);
  }
}
