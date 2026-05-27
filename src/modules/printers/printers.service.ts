import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PrinterEntity } from './entities/printer.entity';
import {
  PrintJobEntity,
  PrintJobStatus,
} from './entities/print-job.entity';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { PrinterResponseDto } from './dto/printer-response.dto';
import { PrintJobResponseDto } from './dto/print-job-response.dto';
import { EscPosSender } from './print/esc-pos-sender';
import { StoreScopeService } from '../../common/services/store-scope.service';
import { StoreEntity } from '../store/entities/store.entity';

@Injectable()
export class PrintersService {
  constructor(
    @InjectRepository(PrinterEntity)
    private readonly repo: Repository<PrinterEntity>,
    @InjectRepository(PrintJobEntity)
    private readonly jobRepo: Repository<PrintJobEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    private readonly storeScope: StoreScopeService,
    private readonly escPos: EscPosSender,
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

  /**
   * Queues a TEST print job and attempts best-effort ESC/POS delivery if the
   * printer is on the network. Non-network printers (USB / Bluetooth / cloud)
   * leave the job in `queued` state for a downstream agent to pick up.
   *
   * Always returns the resulting job row — sent (delivered), failed (attempt
   * exhausted with an error), or queued (no network address to dial).
   */
  async runTestPrint(
    businessId: string,
    printerId: string,
  ): Promise<PrintJobResponseDto> {
    const printer = await this.findEntity(businessId, printerId);

    const job = this.jobRepo.create({
      printerId: printer.id,
      storeId: printer.storeId,
      type: 'test',
      payload: { printerName: printer.name, requestedAt: new Date().toISOString() },
      status: 'queued',
      attempts: 0,
    });
    const saved = await this.jobRepo.save(job);

    if (printer.connection !== 'network' || !printer.address) {
      // Nothing to do here — the queued row is the record of the request.
      return PrintJobResponseDto.from(saved);
    }

    saved.attempts += 1;
    const payload = this.escPos.buildTestPayload(printer.name);
    const result = await this.escPos.sendOverTcp(printer.address, payload);
    if (result.ok) {
      saved.status = 'sent';
      saved.sentAt = new Date();
      saved.lastError = null;
      // Treat a successful test as a heartbeat — useful for the workstation
      // status indicator.
      printer.lastSeenAt = saved.sentAt;
      await this.repo.save(printer);
    } else {
      saved.status = 'failed';
      saved.lastError = result.error ?? 'Unknown delivery error';
    }
    const persisted = await this.jobRepo.save(saved);
    return PrintJobResponseDto.from(persisted);
  }

  async listJobs(
    businessId: string,
    printerId: string,
    status?: PrintJobStatus,
    limit = 25,
  ): Promise<PrintJobResponseDto[]> {
    await this.findEntity(businessId, printerId); // scope check
    const qb = this.jobRepo
      .createQueryBuilder('j')
      .where('j.printerId = :printerId', { printerId })
      .orderBy('j.createdAt', 'DESC')
      .take(Math.min(100, Math.max(1, limit)));
    if (status) qb.andWhere('j.status = :status', { status });
    const rows = await qb.getMany();
    return PrintJobResponseDto.fromMany(rows);
  }
}
