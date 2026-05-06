import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentEntity } from './entities/equipment.entity';
import { EquipmentMaintenanceEntity } from './entities/equipment-maintenance.entity';
import {
  CreateEquipmentDto,
  CreateMaintenanceLogDto,
  EquipmentFilterDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import {
  EquipmentResponseDto,
  MaintenanceLogResponseDto,
} from './dto/equipment-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EquipmentEntity)
    private readonly repo: Repository<EquipmentEntity>,
    @InjectRepository(EquipmentMaintenanceEntity)
    private readonly maintenanceRepo: Repository<EquipmentMaintenanceEntity>,
  ) {}

  async findAll(
    filter: EquipmentFilterDto,
  ): Promise<PaginatedResponseDto<EquipmentResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('e')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('e.createdAt', 'DESC');
    if (filter.storeId)
      qb.andWhere('e.storeId = :storeId', { storeId: filter.storeId });
    if (filter.locationId)
      qb.andWhere('e.locationId = :locationId', {
        locationId: filter.locationId,
      });
    if (filter.category) qb.andWhere('e.category = :c', { c: filter.category });
    if (filter.status) qb.andWhere('e.status = :s', { s: filter.status });
    if (filter.search)
      qb.andWhere('(e.name ILIKE :s OR e.model ILIKE :s OR e.serialNumber ILIKE :s)', {
        s: `%${filter.search}%`,
      });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, EquipmentResponseDto.from);
  }

  async findOne(id: string): Promise<EquipmentResponseDto> {
    const eq = await this.repo.findOne({ where: { id } });
    if (!eq) throw new NotFoundException('Equipment not found');
    return EquipmentResponseDto.from(eq);
  }

  async create(dto: CreateEquipmentDto): Promise<EquipmentResponseDto> {
    const eq = await this.repo.save(this.repo.create(dto));
    return EquipmentResponseDto.from(eq);
  }

  async update(
    id: string,
    dto: UpdateEquipmentDto,
  ): Promise<EquipmentResponseDto> {
    const eq = await this.repo.findOne({ where: { id } });
    if (!eq) throw new NotFoundException('Equipment not found');
    Object.assign(eq, dto);
    const saved = await this.repo.save(eq);
    return EquipmentResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const eq = await this.repo.findOne({ where: { id } });
    if (!eq) throw new NotFoundException('Equipment not found');
    await this.repo.softRemove(eq);
  }

  // ---------- Maintenance ----------

  async listMaintenance(
    equipmentId: string,
  ): Promise<MaintenanceLogResponseDto[]> {
    const logs = await this.maintenanceRepo.find({
      where: { equipmentId },
      order: { performedOn: 'DESC' },
    });
    return logs.map(MaintenanceLogResponseDto.from);
  }

  async logMaintenance(
    equipmentId: string,
    dto: CreateMaintenanceLogDto,
  ): Promise<MaintenanceLogResponseDto> {
    const eq = await this.repo.findOne({ where: { id: equipmentId } });
    if (!eq) throw new NotFoundException('Equipment not found');

    const log = this.maintenanceRepo.create({ equipmentId, ...dto });
    const saved = await this.maintenanceRepo.save(log);

    eq.lastMaintenanceDate = dto.performedOn;
    if (eq.maintenanceCycleDays) {
      const next = new Date(dto.performedOn);
      next.setDate(next.getDate() + eq.maintenanceCycleDays);
      eq.nextMaintenanceDate = next.toISOString().slice(0, 10);
    }
    await this.repo.save(eq);

    return MaintenanceLogResponseDto.from(saved);
  }
}
