import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { ComboEntity } from './entities/combo.entity';
import { ComboItemEntity } from './entities/combo-item.entity';
import { CreateComboDto, CreateComboItemDto } from './dto/create-combo.dto';
import { UpdateComboDto, ToggleComboStatusDto } from './dto/update-combo.dto';
import { UpdateComboItemDto } from './dto/update-combo-item.dto';
import { FilterComboDto } from './dto/filter-combo.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CombosService {
  constructor(
    @InjectRepository(ComboEntity)
    private readonly comboRepo: Repository<ComboEntity>,
    @InjectRepository(ComboItemEntity)
    private readonly comboItemRepo: Repository<ComboItemEntity>,
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

  async create(dto: CreateComboDto): Promise<ComboEntity> {
    const { products, imageFileId, imageUrl, ...comboData } = dto;
    const combo = this.comboRepo.create(comboData);
    await this.resolveImageFields(combo, { imageFileId, imageUrl });

    if (products?.length) {
      combo.items = products.map((p) =>
        this.comboItemRepo.create({ productId: p.productId, quantity: p.quantity ?? 1 }),
      );
    }

    return this.comboRepo.save(combo);
  }

  async findAll(query: FilterComboDto): Promise<PaginatedResponseDto<ComboEntity>> {
    const { page = 1, limit = 20, storeId, status, search } = query;
    const where: FindOptionsWhere<ComboEntity> = {};

    if (storeId) where.storeId = storeId;
    if (status !== undefined) where.isActive = status;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.comboRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string): Promise<ComboEntity> {
    const combo = await this.comboRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!combo) throw new NotFoundException(`Combo ${id} not found`);
    return combo;
  }

  async getStats(storeId?: string) {
    const where: FindOptionsWhere<ComboEntity> = {};
    if (storeId) where.storeId = storeId;

    const combos = await this.comboRepo.find({ where });
    const active = combos.filter((c) => c.isActive).length;
    const totalSales = combos.reduce((sum, c) => sum + c.sales, 0);
    const revenue = combos.reduce((sum, c) => sum + c.sales * Number(c.price), 0);

    return { total: combos.length, active, totalSales, revenue };
  }

  async update(id: string, dto: UpdateComboDto): Promise<ComboEntity> {
    const combo = await this.findOne(id);
    const { imageFileId, imageUrl, ...rest } = dto;
    Object.assign(combo, rest);
    await this.resolveImageFields(combo, { imageFileId, imageUrl });
    return this.comboRepo.save(combo);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.comboRepo.softDelete(id);
  }

  async toggleStatus(id: string, dto: ToggleComboStatusDto): Promise<ComboEntity> {
    const combo = await this.findOne(id);
    combo.isActive = dto.isActive;
    return this.comboRepo.save(combo);
  }

  async addItem(comboId: string, dto: CreateComboItemDto): Promise<ComboItemEntity> {
    await this.findOne(comboId);
    const item = this.comboItemRepo.create({
      comboId,
      productId: dto.productId,
      quantity: dto.quantity ?? 1,
    });
    return this.comboItemRepo.save(item);
  }

  async updateItem(comboId: string, itemId: string, dto: UpdateComboItemDto): Promise<ComboItemEntity> {
    const item = await this.findItem(comboId, itemId);
    item.quantity = dto.quantity;
    return this.comboItemRepo.save(item);
  }

  async removeItem(comboId: string, itemId: string): Promise<void> {
    const item = await this.findItem(comboId, itemId);
    await this.comboItemRepo.remove(item);
  }

  private async findItem(comboId: string, itemId: string): Promise<ComboItemEntity> {
    const item = await this.comboItemRepo.findOne({
      where: { id: itemId, comboId },
    });
    if (!item) throw new NotFoundException(`Combo item ${itemId} not found in combo ${comboId}`);
    return item;
  }
}
