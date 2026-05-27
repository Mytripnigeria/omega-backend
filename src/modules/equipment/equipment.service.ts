import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentEntity } from './entities/equipment.entity';
import { EquipmentMaintenanceEntity } from './entities/equipment-maintenance.entity';
import { EquipmentTemperatureReadingEntity } from './entities/equipment-temperature-reading.entity';
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
import {
  CreateTemperatureReadingDto,
  EquipmentTemperatureStatusDto,
  TemperatureReadingResponseDto,
} from './dto/temperature-reading.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

interface TemperatureActor {
  sub: string;
  actorName?: string | null;
}

/** A reading is considered "stale" if the latest one is older than this. */
const STALE_READING_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EquipmentEntity)
    private readonly repo: Repository<EquipmentEntity>,
    @InjectRepository(EquipmentMaintenanceEntity)
    private readonly maintenanceRepo: Repository<EquipmentMaintenanceEntity>,
    @InjectRepository(EquipmentTemperatureReadingEntity)
    private readonly tempReadingRepo: Repository<EquipmentTemperatureReadingEntity>,
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

  // ---------- Temperature readings ----------

  /**
   * Records a temperature reading against an equipment item, computes whether
   * it's inside the configured safe range, and denormalizes the value onto the
   * equipment row so the workstation can render a single "status" view fast.
   */
  async logTemperatureReading(
    equipmentId: string,
    dto: CreateTemperatureReadingDto,
    actor: TemperatureActor | null,
  ): Promise<TemperatureReadingResponseDto> {
    const eq = await this.repo.findOne({ where: { id: equipmentId } });
    if (!eq) throw new NotFoundException('Equipment not found');

    const value = Number(dto.temperatureC);
    const min = eq.minTempC == null ? null : Number(eq.minTempC);
    const max = eq.maxTempC == null ? null : Number(eq.maxTempC);
    const isInRange =
      min == null && max == null
        ? true
        : (min == null || value >= min) && (max == null || value <= max);

    const reading = this.tempReadingRepo.create({
      equipmentId,
      storeId: eq.storeId,
      temperatureC: value,
      isInRange,
      recordedById: actor?.sub ?? null,
      recordedByName: actor?.actorName ?? null,
      note: dto.note ?? null,
    });
    const saved = await this.tempReadingRepo.save(reading);

    eq.currentTemperature = value;
    eq.lastReadingAt = saved.recordedAt;
    await this.repo.save(eq);

    return TemperatureReadingResponseDto.from(saved);
  }

  async listReadings(
    equipmentId: string,
    days: number,
  ): Promise<TemperatureReadingResponseDto[]> {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() - days);
    const rows = await this.tempReadingRepo
      .createQueryBuilder('r')
      .where('r.equipmentId = :equipmentId', { equipmentId })
      .andWhere('r.recordedAt >= :horizon', { horizon })
      .orderBy('r.recordedAt', 'DESC')
      .getMany();
    return TemperatureReadingResponseDto.fromMany(rows);
  }

  /**
   * Returns one status row per equipment item that has at least one of
   * `minTempC`/`maxTempC`/`currentTemperature` set, so the workstation card
   * can show out-of-range counts cheaply.
   */
  async getTemperatureStatus(
    storeId?: string,
  ): Promise<EquipmentTemperatureStatusDto[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('(e.minTempC IS NOT NULL OR e.maxTempC IS NOT NULL OR e.currentTemperature IS NOT NULL)')
      .orderBy('e.name', 'ASC');
    if (storeId) qb.andWhere('e.storeId = :storeId', { storeId });

    const equipment = await qb.getMany();
    const now = Date.now();

    return equipment.map((eq): EquipmentTemperatureStatusDto => {
      const min = eq.minTempC == null ? null : Number(eq.minTempC);
      const max = eq.maxTempC == null ? null : Number(eq.maxTempC);
      const current =
        eq.currentTemperature == null ? null : Number(eq.currentTemperature);

      let state: EquipmentTemperatureStatusDto['state'] = 'unmeasured';
      if (current != null && eq.lastReadingAt) {
        const ageMs = now - new Date(eq.lastReadingAt).getTime();
        if (ageMs > STALE_READING_AFTER_MS) state = 'stale';
        else if (
          (min != null && current < min) ||
          (max != null && current > max)
        ) {
          state = 'out_of_range';
        } else if (min != null || max != null) {
          state = 'ok';
        } else {
          // Reading exists but no range configured.
          state = 'unmeasured';
        }
      }

      return {
        equipmentId: eq.id,
        name: eq.name,
        minTempC: min,
        maxTempC: max,
        currentTemperature: current,
        lastReadingAt: eq.lastReadingAt,
        state,
      };
    });
  }
}
