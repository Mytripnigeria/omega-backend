import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftEntity, ShiftStatus } from './entities/shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftFilterDto } from './dto/shift-filter.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(ShiftEntity)
    private readonly shiftRepo: Repository<ShiftEntity>,
  ) {}

  private toResponseDto(shift: ShiftEntity) {
    return {
      id: shift.id,
      storeId: shift.storeId,
      staffId: shift.staffId,
      staffName: shift.staff
        ? `${shift.staff.firstName} ${shift.staff.lastName}`
        : '',
      roleId: shift.roleId ?? null,
      roleName: shift.role?.name ?? null,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDuration: shift.breakDuration ?? null,
      status: shift.status,
      actualClockIn: shift.actualClockIn ?? null,
      actualClockOut: shift.actualClockOut ?? null,
      notes: shift.notes ?? null,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
    };
  }

  async create(dto: CreateShiftDto) {
    const shift = this.shiftRepo.create(dto);
    const saved = await this.shiftRepo.save(shift);
    return this.findOneWithRelations(saved.id);
  }

  async findAll(filter: ShiftFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.shiftRepo
      .createQueryBuilder('sh')
      .leftJoinAndSelect('sh.staff', 'staff')
      .leftJoinAndSelect('sh.role', 'role')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('sh.date', 'DESC')
      .addOrderBy('sh.startTime', 'ASC');

    if (filter.storeId) qb.andWhere('sh.storeId = :storeId', { storeId: filter.storeId });
    if (filter.staffId) qb.andWhere('sh.staffId = :staffId', { staffId: filter.staffId });
    if (filter.roleId) qb.andWhere('sh.roleId = :roleId', { roleId: filter.roleId });
    if (filter.status) qb.andWhere('sh.status = :status', { status: filter.status });
    if (filter.date) qb.andWhere('sh.date = :date', { date: filter.date });
    if (filter.dateFrom) qb.andWhere('sh.date >= :dateFrom', { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('sh.date <= :dateTo', { dateTo: filter.dateTo });

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.of(
      data.map((s) => this.toResponseDto(s)),
      total,
      page,
      limit,
    );
  }

  private async findOneWithRelations(id: string): Promise<ReturnType<typeof this.toResponseDto>> {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['staff', 'role'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.toResponseDto(shift);
  }

  async findOne(id: string) {
    return this.findOneWithRelations(id);
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    Object.assign(shift, dto);
    await this.shiftRepo.save(shift);
    return this.findOneWithRelations(id);
  }

  async remove(id: string): Promise<void> {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.shiftRepo.delete(id);
  }

  async clockIn(shiftId: string, staffId: string) {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['staff', 'role'] });
    if (!shift) throw new NotFoundException('Shift not found');

    if (shift.staffId !== staffId) {
      throw new ForbiddenException('You can only clock in to your own shift');
    }
    if (shift.status !== ShiftStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot clock in: shift is ${shift.status}`);
    }

    shift.actualClockIn = new Date();
    shift.status = ShiftStatus.IN_PROGRESS;
    await this.shiftRepo.save(shift);
    return this.toResponseDto(shift);
  }

  async clockOut(shiftId: string, staffId: string) {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId }, relations: ['staff', 'role'] });
    if (!shift) throw new NotFoundException('Shift not found');

    if (shift.staffId !== staffId) {
      throw new ForbiddenException('You can only clock out of your own shift');
    }
    if (shift.status !== ShiftStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot clock out: shift is not in progress`);
    }

    shift.actualClockOut = new Date();
    shift.status = ShiftStatus.COMPLETED;
    await this.shiftRepo.save(shift);
    return this.toResponseDto(shift);
  }
}
