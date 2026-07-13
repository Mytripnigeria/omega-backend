import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { StaffEntity } from './entities/staff.entity';
import { StaffDocumentEntity } from './entities/staff-document.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { BusinessSettingsEntity } from '../business/entities/business-settings.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import {
  StaffResponseDto,
  StaffDocumentResponseDto,
} from './dto/staff-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import {
  StaffPreferencesDto,
  UpdateStaffPreferencesDto,
  mergeStaffPreferences,
} from './dto/preferences.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(StaffDocumentEntity)
    private readonly docRepo: Repository<StaffDocumentEntity>,
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(BusinessSettingsEntity)
    private readonly businessSettingsRepo: Repository<BusinessSettingsEntity>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolves the staff-code prefix for a store's business (configurable in
   * Settings → staffCodePrefix, default "STF").
   */
  private async resolvePrefix(storeId: string): Promise<string> {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store?.businessId) return 'STF';
    const settings = await this.businessSettingsRepo.findOne({
      where: { businessId: store.businessId },
    });
    return settings?.staffCodePrefix?.trim() || 'STF';
  }

  /**
   * Next monotonic staff code for a prefix, e.g. "MJS" → MJS001. The counter is
   * per-prefix: we only consider existing codes shaped `<prefix><digits>`, then
   * take the max numeric suffix (+1). `withDeleted` so soft-deleted codes are
   * never reused.
   */
  private async generateStaffCode(prefix: string): Promise<string> {
    const result = await this.staffRepo
      .createQueryBuilder('s')
      .withDeleted()
      .where("s.staffCode ~ :re", { re: `^${prefix}[0-9]+$` })
      .select(
        `MAX(CAST(SUBSTRING(s.staffCode, ${prefix.length + 1}) AS INTEGER))`,
        'maxNum',
      )
      .getRawOne<{ maxNum: number | null }>();

    const next = (result?.maxNum ?? 0) + 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  async create(dto: CreateStaffDto): Promise<StaffResponseDto> {
    const prefix = await this.resolvePrefix(dto.storeId);
    const staffCode = await this.generateStaffCode(prefix);
    const staff = this.staffRepo.create({ ...dto, staffCode });
    const saved = await this.staffRepo.save(staff);
    return this.findOne(saved.id);
  }

  async findAll(filter: StaffFilterDto): Promise<PaginatedResponseDto<StaffResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.staffRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.role', 'role')
      .leftJoinAndSelect('s.documents', 'documents')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.createdAt', 'DESC');

    if (filter.storeId) qb.andWhere('s.storeId = :storeId', { storeId: filter.storeId });
    if (filter.roleId) qb.andWhere('s.roleId = :roleId', { roleId: filter.roleId });
    if (filter.status) qb.andWhere('s.status = :status', { status: filter.status });
    if (filter.employmentType) {
      qb.andWhere('s.employmentType = :employmentType', {
        employmentType: filter.employmentType,
      });
    }
    if (filter.search) {
      qb.andWhere(
        "(s.firstName ILIKE :search OR s.lastName ILIKE :search OR s.email ILIKE :search OR s.staffCode ILIKE :search)",
        { search: `%${filter.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, StaffResponseDto.from);
  }

  async findOne(id: string): Promise<StaffResponseDto> {
    return StaffResponseDto.from(await this.findEntityWithRelations(id));
  }

  private async findEntityWithRelations(id: string): Promise<StaffEntity> {
    const staff = await this.staffRepo.findOne({
      where: { id },
      relations: ['role', 'documents'],
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async findByStaffCode(staffCode: string): Promise<StaffEntity | null> {
    return this.staffRepo.findOne({
      where: { staffCode },
      relations: ['role'],
    });
  }

  async findByStaffCodeWithPin(staffCode: string): Promise<StaffEntity | null> {
    return this.staffRepo
      .createQueryBuilder('s')
      .addSelect('s.pin')
      .leftJoinAndSelect('s.role', 'role')
      .leftJoinAndSelect('s.store', 'store')
      .where('s.staffCode = :staffCode', { staffCode })
      .getOne();
  }

  async update(id: string, dto: UpdateStaffDto): Promise<StaffResponseDto> {
    const staff = await this.findEntityWithRelations(id);
    Object.assign(staff, dto);
    await this.staffRepo.save(staff);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff member not found');
    await this.staffRepo.softDelete(id);
  }

  async setPin(id: string, dto: SetPinDto): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
    const hashedPin = await bcrypt.hash(dto.pin, saltRounds);
    await this.staffRepo.update(id, { pin: hashedPin });
  }

  async clearPin(id: string): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff member not found');
    await this.staffRepo.update(id, { pin: undefined });
  }

  async addDocument(staffId: string, dto: AddDocumentDto): Promise<StaffDocumentResponseDto> {
    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const doc = this.docRepo.create({ staffId, ...dto });
    const saved = await this.docRepo.save(doc);
    return StaffDocumentResponseDto.from(saved);
  }

  async removeDocument(staffId: string, docId: string): Promise<void> {
    const doc = await this.docRepo.findOne({
      where: { id: docId, staffId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.docRepo.delete(docId);
  }

  async getStats(storeId?: string) {
    const qb = this.staffRepo.createQueryBuilder('s');
    if (storeId) qb.where('s.storeId = :storeId', { storeId });

    const [total, active, onLeave, inactive, terminated] = await Promise.all([
      qb.getCount(),
      qb.clone().andWhere('s.status = :s', { s: 'active' }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: 'on-leave' }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: 'inactive' }).getCount(),
      qb.clone().andWhere('s.status = :s', { s: 'terminated' }).getCount(),
    ]);

    return { total, active, onLeave, inactive, terminated };
  }

  // ─── Per-staff preferences ──────────────────────────────────────────────

  /**
   * Returns the staff member's preferences merged with defaults. Used by the
   * workstation Settings page; the merger drops any keys not in the
   * whitelist so we don't leak stale-shape data to clients.
   */
  async getPreferences(staffId: string): Promise<StaffPreferencesDto> {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      select: ['id', 'preferences'],
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return mergeStaffPreferences(staff.preferences);
  }

  async updatePreferences(
    staffId: string,
    patch: UpdateStaffPreferencesDto,
  ): Promise<StaffPreferencesDto> {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      select: ['id', 'preferences'],
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const merged = mergeStaffPreferences({ ...(staff.preferences ?? {}), ...patch });
    staff.preferences = { ...merged };
    await this.staffRepo.save(staff);
    return merged;
  }
}
