import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PrinterEntity } from './entities/printer.entity';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { PrinterResponseDto } from './dto/printer-response.dto';
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

  async list(businessId: string, storeId?: string): Promise<PrinterResponseDto[]> {
    if (storeId) {
      await this.storeScope.assertStoreInBusiness(storeId, businessId);
      const items = await this.repo.find({
        where: { storeId },
        order: { createdAt: 'ASC' },
      });
      return PrinterResponseDto.fromMany(items);
    }
    const stores = await this.storeRepo.find({ where: { businessId }, select: ['id'] });
    if (stores.length === 0) return [];
    const items = await this.repo.find({
      where: { storeId: In(stores.map((s) => s.id)) },
      order: { createdAt: 'ASC' },
    });
    return PrinterResponseDto.fromMany(items);
  }

  async findOne(businessId: string, id: string): Promise<PrinterResponseDto> {
    return PrinterResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(businessId: string, id: string): Promise<PrinterEntity> {
    const printer = await this.repo.findOne({ where: { id } });
    if (!printer) throw new NotFoundException(`Printer ${id} not found`);
    await this.storeScope.assertStoreInBusiness(printer.storeId, businessId);
    return printer;
  }

  async create(businessId: string, dto: CreatePrinterDto): Promise<PrinterResponseDto> {
    await this.storeScope.assertStoreInBusiness(dto.storeId, businessId);
    const printer = this.repo.create(dto);
    const saved = await this.repo.save(printer);
    return PrinterResponseDto.from(saved);
  }

  async update(businessId: string, id: string, dto: UpdatePrinterDto): Promise<PrinterResponseDto> {
    const printer = await this.findEntity(businessId, id);
    Object.assign(printer, dto);
    const saved = await this.repo.save(printer);
    return PrinterResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
    await this.repo.softDelete(id);
  }
}
