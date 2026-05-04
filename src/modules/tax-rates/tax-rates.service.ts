import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TaxRateEntity } from './entities/tax-rate.entity';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';

@Injectable()
export class TaxRatesService {
  constructor(
    @InjectRepository(TaxRateEntity)
    private readonly taxRepo: Repository<TaxRateEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(businessId: string): Promise<TaxRateEntity[]> {
    return this.taxRepo.find({
      where: { businessId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<TaxRateEntity> {
    const tax = await this.taxRepo.findOne({ where: { id, businessId } });
    if (!tax) throw new NotFoundException(`Tax rate ${id} not found`);
    return tax;
  }

  async create(businessId: string, dto: CreateTaxRateDto): Promise<TaxRateEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TaxRateEntity);
      if (dto.isDefault) {
        await repo.update({ businessId, isDefault: true }, { isDefault: false });
      }
      const tax = repo.create({ ...dto, businessId });
      return repo.save(tax);
    });
  }

  async update(businessId: string, id: string, dto: UpdateTaxRateDto): Promise<TaxRateEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TaxRateEntity);
      const tax = await repo.findOne({ where: { id, businessId } });
      if (!tax) throw new NotFoundException(`Tax rate ${id} not found`);
      if (dto.isDefault === true && !tax.isDefault) {
        await repo.update({ businessId, isDefault: true }, { isDefault: false });
      }
      Object.assign(tax, dto);
      return repo.save(tax);
    });
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.taxRepo.softDelete(id);
  }
}
