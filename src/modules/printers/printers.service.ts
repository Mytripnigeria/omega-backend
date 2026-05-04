import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PrinterEntity } from './entities/printer.entity';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { StoreScopeService } from '../../common/services/store-scope.service';
import { StoreEntity } from '../store/entities/store.entity';

@Injectable()
export class PrintersService {
  constructor(
    @InjectRepository(PrinterEntity)
    private readonly repo: Repository<PrinterEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly storeScope: StoreScopeService,
  ) {}

  async list(businessId: string, storeId?: string): Promise<PrinterEntity[]> {
    if (storeId) {
      await this.storeScope.assertStoreInBusiness(storeId, businessId);
      return this.repo.find({
        where: { storeId },
        order: { createdAt: 'ASC' },
      });
    }
    // No storeId given — return printers across all stores in this business.
    const stores = await this.storeRepo.find({ where: { businessId }, select: ['id'] });
    if (stores.length === 0) return [];
    return this.repo.find({
      where: { storeId: In(stores.map((s) => s.id)) },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<PrinterEntity> {
    const printer = await this.repo.findOne({ where: { id } });
    if (!printer) throw new NotFoundException(`Printer ${id} not found`);
    await this.storeScope.assertStoreInBusiness(printer.storeId, businessId);
    return printer;
  }

  async create(businessId: string, dto: CreatePrinterDto): Promise<PrinterEntity> {
    await this.storeScope.assertStoreInBusiness(dto.storeId, businessId);
    const printer = this.repo.create(dto);
    return this.repo.save(printer);
  }

  async update(businessId: string, id: string, dto: UpdatePrinterDto): Promise<PrinterEntity> {
    const printer = await this.findOne(businessId, id);
    Object.assign(printer, dto);
    return this.repo.save(printer);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.repo.softDelete(id);
  }
}
