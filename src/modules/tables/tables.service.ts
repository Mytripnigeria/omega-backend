import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableEntity, TableStatus } from './entities/table.entity';
import {
  CreateTableDto,
  TableFilterDto,
  TableResponseDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(TableEntity)
    private readonly repo: Repository<TableEntity>,
  ) {}

  async list(
    businessId: string,
    filter: TableFilterDto,
  ): Promise<TableResponseDto[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.businessId = :businessId', { businessId })
      .orderBy('t.section', 'ASC')
      .addOrderBy('t.name', 'ASC');
    if (filter.storeId) qb.andWhere('t.storeId = :storeId', { storeId: filter.storeId });
    if (filter.status) qb.andWhere('t.status = :status', { status: filter.status });
    if (filter.section) qb.andWhere('t.section = :section', { section: filter.section });
    const rows = await qb.getMany();
    return TableResponseDto.fromMany(rows);
  }

  async findOne(businessId: string, id: string): Promise<TableResponseDto> {
    return TableResponseDto.from(await this.findEntity(businessId, id));
  }

  async findEntity(businessId: string, id: string): Promise<TableEntity> {
    const table = await this.repo.findOne({ where: { id } });
    if (!table || table.businessId !== businessId) {
      throw new NotFoundException(`Table ${id} not found`);
    }
    return table;
  }

  async create(businessId: string, dto: CreateTableDto): Promise<TableResponseDto> {
    const table = this.repo.create({ ...dto, businessId });
    const saved = await this.repo.save(table);
    return TableResponseDto.from(saved);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateTableDto,
  ): Promise<TableResponseDto> {
    const table = await this.findEntity(businessId, id);
    Object.assign(table, dto);
    const saved = await this.repo.save(table);
    return TableResponseDto.from(saved);
  }

  async updateStatus(
    businessId: string,
    id: string,
    dto: UpdateTableStatusDto,
  ): Promise<TableResponseDto> {
    const table = await this.findEntity(businessId, id);
    table.status = dto.status;
    const saved = await this.repo.save(table);
    return TableResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.repo.softDelete(id);
  }

  /**
   * Called by the orders module when an order is opened on a table —
   * snapshots the label and transitions the table to `occupied`.
   * Returns the table's current name so the order can persist it.
   */
  async assignToOrder(businessId: string, tableId: string): Promise<TableEntity> {
    const table = await this.findEntity(businessId, tableId);
    if (table.status !== TableStatus.OCCUPIED) {
      table.status = TableStatus.OCCUPIED;
      await this.repo.save(table);
    }
    return table;
  }

  /**
   * Called by the orders module when an order is closed / cancelled — frees
   * the table back to `available` so it can be re-seated. No-op if the table
   * has already been moved on (e.g. manually marked `cleaning`).
   */
  async releaseFromOrder(businessId: string, tableId: string): Promise<void> {
    try {
      const table = await this.findEntity(businessId, tableId);
      if (table.status === TableStatus.OCCUPIED) {
        table.status = TableStatus.AVAILABLE;
        await this.repo.save(table);
      }
    } catch {
      // Table may have been deleted in the meantime — ignore.
    }
  }
}
