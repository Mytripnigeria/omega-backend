import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { DeliveryRegionEntity } from './entities/delivery-region.entity';
import {
  CreateDeliveryRegionDto,
  DeliveryRegionFilterDto,
  DeliveryRegionResponseDto,
  UpdateDeliveryRegionDto,
} from './dto/delivery-region.dto';

@Injectable()
export class DeliveryRegionsService {
  constructor(
    @InjectRepository(DeliveryRegionEntity)
    private readonly repo: Repository<DeliveryRegionEntity>,
  ) {}

  async findAll(
    filter: DeliveryRegionFilterDto,
  ): Promise<DeliveryRegionResponseDto[]> {
    const where: FindOptionsWhere<DeliveryRegionEntity> = {};
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const rows = await this.repo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(DeliveryRegionResponseDto.from);
  }

  async findEntity(id: string): Promise<DeliveryRegionEntity> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Delivery region ${id} not found`);
    return row;
  }

  async findOne(id: string): Promise<DeliveryRegionResponseDto> {
    return DeliveryRegionResponseDto.from(await this.findEntity(id));
  }

  async create(
    dto: CreateDeliveryRegionDto,
  ): Promise<DeliveryRegionResponseDto> {
    const row = this.repo.create(dto);
    try {
      return DeliveryRegionResponseDto.from(await this.repo.save(row));
    } catch (err) {
      throw this.asConflict(err, dto.name);
    }
  }

  async update(
    id: string,
    dto: UpdateDeliveryRegionDto,
  ): Promise<DeliveryRegionResponseDto> {
    const row = await this.findEntity(id);
    Object.assign(row, dto);
    try {
      return DeliveryRegionResponseDto.from(await this.repo.save(row));
    } catch (err) {
      throw this.asConflict(err, dto.name ?? row.name);
    }
  }

  async remove(id: string): Promise<void> {
    const row = await this.findEntity(id);
    await this.repo.remove(row);
  }

  private asConflict(err: unknown, name: string): unknown {
    if (
      err instanceof QueryFailedError &&
      (err as unknown as { code?: string }).code === '23505'
    ) {
      return new ConflictException(
        `A delivery region named "${name}" already exists for this store`,
      );
    }
    return err;
  }
}
