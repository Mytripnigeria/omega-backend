import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierEntity } from './entities/supplier.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import {
  CreateSupplierDto,
  SupplierFilterDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly repo: Repository<SupplierEntity>,
    @InjectRepository(IngredientEntity)
    private readonly ingredientRepo: Repository<IngredientEntity>,
  ) {}

  async findAll(
    businessId: string,
    filter: SupplierFilterDto,
  ): Promise<PaginatedResponseDto<SupplierResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.createdAt', 'DESC');

    if (filter.status) qb.andWhere('s.status = :status', { status: filter.status });
    if (filter.category)
      qb.andWhere('s.category ILIKE :c', { c: `%${filter.category}%` });
    if (filter.search)
      qb.andWhere('(s.name ILIKE :q OR s.contactPerson ILIKE :q OR s.email ILIKE :q)', {
        q: `%${filter.search}%`,
      });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, SupplierResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<SupplierResponseDto> {
    const supplier = await this.findEntity(businessId, id);
    return SupplierResponseDto.from(supplier);
  }

  private async findEntity(businessId: string, id: string): Promise<SupplierEntity> {
    const supplier = await this.repo.findOne({ where: { id, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(
    businessId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const existing = await this.repo.findOne({
      where: { businessId, name: dto.name },
    });
    if (existing)
      throw new ConflictException(
        'A supplier with this name already exists',
      );
    const supplier = this.repo.create({ ...dto, businessId });
    const saved = await this.repo.save(supplier);
    return SupplierResponseDto.from(saved);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.findEntity(businessId, id);
    Object.assign(supplier, dto);
    const saved = await this.repo.save(supplier);
    return SupplierResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const supplier = await this.findEntity(businessId, id);
    await this.repo.softRemove(supplier);
  }

  async getStats(businessId: string) {
    const total = await this.repo.count({ where: { businessId } });
    const active = await this.repo.count({
      where: { businessId, status: 'active' as never },
    });
    return { total, active };
  }

  async getIngredientsForSupplier(
    businessId: string,
    supplierId: string,
  ) {
    await this.findEntity(businessId, supplierId);
    return this.ingredientRepo.find({
      where: { supplierId },
      take: 100,
    });
  }
}
