import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ShiftEntity, ShiftStatus } from './entities/shift.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import { assertWithinGeofence } from '../../common/utils/geofence';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftFilterDto } from './dto/shift-filter.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';
import { CreateBreakDto } from './dto/break-dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { CashSessionsService } from '../cash-sessions/cash-sessions.service';

@Injectable()
export class ShiftsService implements OnModuleInit {
  private readonly logger = new Logger(ShiftsService.name);
  /** Grace period after a shift's scheduled end before auto clock-out. */
  private static readonly AUTO_CLOCKOUT_GRACE_MIN = 5;

  constructor(
    @InjectRepository(ShiftEntity)
    private readonly shiftRepo: Repository<ShiftEntity>,
    @InjectRepository(StaffEntity)
    private readonly staffRepo: Repository<StaffEntity>,
    @InjectRepository(WorkstationSettingsEntity)
    private readonly workstationSettingsRepo: Repository<WorkstationSettingsEntity>,
    private readonly activityLog: ActivityLogService,
    private readonly cashSessions: CashSessionsService,
  ) {}

  onModuleInit(): void {
    // Sweep once a minute for in-progress shifts whose scheduled end (+grace)
    // has passed and auto clock-out the staff who forgot to. setInterval keeps
    // this dependency-free; unref() so it never blocks process shutdown.
    const timer = setInterval(() => {
      this.autoClockOutExpiredShifts().catch((err) =>
        this.logger.warn(`Auto clock-out sweep failed: ${(err as Error).message}`),
      );
    }, 60_000);
    if (typeof timer.unref === 'function') timer.unref();
  }

  /**
   * Auto clock-out: any IN_PROGRESS shift whose scheduled end time plus a
   * 5-minute grace has elapsed is completed automatically (the staff didn't
   * clock out themselves). Idempotent — only touches IN_PROGRESS rows.
   */
  async autoClockOutExpiredShifts(): Promise<number> {
    const inProgress = await this.shiftRepo.find({
      where: { status: ShiftStatus.IN_PROGRESS },
    });
    const now = Date.now();
    const graceMs = ShiftsService.AUTO_CLOCKOUT_GRACE_MIN * 60_000;
    let closed = 0;

    for (const shift of inProgress) {
      const endTime = (shift.endTime ?? '').slice(0, 5); // HH:MM
      if (!shift.date || !endTime) continue;
      let scheduledEnd = new Date(`${shift.date}T${endTime}:00`).getTime();
      // Overnight shift (end earlier than start) ends on the following day.
      const startTime = (shift.startTime ?? '').slice(0, 5);
      if (startTime && endTime < startTime) scheduledEnd += 24 * 60 * 60_000;
      if (Number.isNaN(scheduledEnd)) continue;

      if (now >= scheduledEnd + graceMs) {
        shift.actualClockOut = new Date();
        shift.status = ShiftStatus.COMPLETED;
        await this.shiftRepo.save(shift);
        closed++;
        this.activityLog.record({
          actorType: 'system',
          actorId: null,
          actorName: 'Auto clock-out',
          action: 'shift.auto_clocked_out',
          businessId: '',
          storeId: shift.storeId,
          resourceType: 'shift',
          resourceId: shift.id,
          metadata: { date: shift.date, endTime: shift.endTime },
        });
      }
    }
    if (closed > 0) this.logger.log(`Auto clocked-out ${closed} shift(s)`);
    return closed;
  }

  async create(dto: CreateShiftDto): Promise<ShiftResponseDto> {
    // Default the shift's role to the staff member's own role unless a
    // particular role was set when creating the shift.
    let roleId = dto.roleId ?? null;
    if (!roleId) {
      const staff = await this.staffRepo.findOne({ where: { id: dto.staffId } });
      roleId = staff?.roleId ?? null;
    }
    const shift = this.shiftRepo.create({ ...dto, roleId: roleId ?? undefined });
    const saved = await this.shiftRepo.save(shift);
    return this.findOne(saved.id);
  }

  async findAll(filter: ShiftFilterDto): Promise<PaginatedResponseDto<ShiftResponseDto>> {
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
    return paginate(data, total, page, limit, ShiftResponseDto.from);
  }

  private async findEntityWithRelations(id: string): Promise<ShiftEntity> {
    const shift = await this.shiftRepo.findOne({
      where: { id },
      relations: ['staff', 'role'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async findOne(id: string): Promise<ShiftResponseDto> {
    return ShiftResponseDto.from(await this.findEntityWithRelations(id));
  }

  async update(id: string, dto: UpdateShiftDto): Promise<ShiftResponseDto> {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');

    // Reassigning the shift to a different staff member without naming a role
    // should carry that person's own role across, exactly as create() does —
    // otherwise the shift keeps the previous holder's role.
    const reassigned = !!dto.staffId && dto.staffId !== shift.staffId;
    Object.assign(shift, dto);
    if (reassigned && !dto.roleId) {
      const staff = await this.staffRepo.findOne({ where: { id: dto.staffId } });
      shift.roleId = staff?.roleId ?? shift.roleId;
    }

    await this.shiftRepo.save(shift);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.shiftRepo.delete(id);
  }

  async clockIn(
    shiftId: string,
    staff: { sub: string; businessId: string; storeId: string },
    coords?: { latitude?: number; longitude?: number },
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);
    if (shift.staffId !== staff.sub) {
      throw new ForbiddenException('You can only clock in to your own shift');
    }
    if (shift.status !== ShiftStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot clock in: shift is ${shift.status}`);
    }

    // Apply the merchant's geofencing rule (Workstation Settings) on clock-in.
    const wsSettings = await this.workstationSettingsRepo.findOne({
      where: { businessId: staff.businessId },
    });
    assertWithinGeofence(wsSettings, coords, 'clock in');

    shift.actualClockIn = new Date();
    shift.status = ShiftStatus.IN_PROGRESS;
    await this.shiftRepo.save(shift);

    this.activityLog.record({
      actorType: 'staff',
      actorId: staff.sub,
      actorName: shift.staff
        ? `${shift.staff.firstName} ${shift.staff.lastName}`
        : 'Staff',
      action: 'shift.clocked_in',
      businessId: staff.businessId,
      storeId: shift.storeId,
      resourceType: 'shift',
      resourceId: shift.id,
      metadata: { date: shift.date, scheduledStart: shift.startTime },
    });

    return ShiftResponseDto.from(shift);
  }

  async updateChecklist(
    shiftId: string,
    staff: { sub: string; businessId: string; storeId: string },
    checklist: ShiftEntity['checklist'],
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);
    if (shift.staffId !== staff.sub) {
      throw new ForbiddenException('You can only update your own shift checklist');
    }
    shift.checklist = checklist ?? null;
    await this.shiftRepo.save(shift);
    return ShiftResponseDto.from(shift);
  }

  async clockOut(
    shiftId: string,
    staff: { sub: string; businessId: string; storeId: string },
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);
    if (shift.staffId !== staff.sub) {
      throw new ForbiddenException('You can only clock out of your own shift');
    }
    if (shift.status !== ShiftStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot clock out: shift is not in progress`);
    }

    const openSession = await this.cashSessions.findActiveForStaff(
      staff.sub,
      shift.storeId,
    );
    if (openSession) {
      throw new BadRequestException(
        'Close your active cash session before clocking out',
      );
    }

    shift.actualClockOut = new Date();
    shift.status = ShiftStatus.COMPLETED;
    await this.shiftRepo.save(shift);

    const durationMs = shift.actualClockIn
      ? shift.actualClockOut.getTime() - new Date(shift.actualClockIn).getTime()
      : null;

    this.activityLog.record({
      actorType: 'staff',
      actorId: staff.sub,
      actorName: shift.staff
        ? `${shift.staff.firstName} ${shift.staff.lastName}`
        : 'Staff',
      action: 'shift.clocked_out',
      businessId: staff.businessId,
      storeId: shift.storeId,
      resourceType: 'shift',
      resourceId: shift.id,
      metadata: {
        date: shift.date,
        durationMinutes: durationMs ? Math.round(durationMs / 60000) : null,
      },
    });

    return ShiftResponseDto.from(shift);
  }

  async adminEnd(
    shiftId: string,
    admin: { sub: string; email?: string; businessId: string },
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);
    if (
      shift.status === ShiftStatus.COMPLETED ||
      shift.status === ShiftStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot end shift: already ${shift.status}`);
    }

    shift.actualClockOut = new Date();
    shift.status = ShiftStatus.COMPLETED;
    await this.shiftRepo.save(shift);

    const durationMs = shift.actualClockIn
      ? shift.actualClockOut.getTime() - new Date(shift.actualClockIn).getTime()
      : null;

    this.activityLog.record({
      actorType: 'admin',
      actorId: admin.sub,
      actorName: admin.email ?? 'Admin',
      action: 'shift.admin_ended',
      businessId: admin.businessId,
      storeId: shift.storeId,
      resourceType: 'shift',
      resourceId: shift.id,
      metadata: {
        date: shift.date,
        staffId: shift.staffId,
        durationMinutes: durationMs ? Math.round(durationMs / 60000) : null,
      },
    });

    return ShiftResponseDto.from(shift);
  }

  async addBreak(
    shiftId: string,
    actor: JwtPayload,
    dto: CreateBreakDto,
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);

    if (actor.sub_type === 'staff' && shift.staffId !== actor.sub) {
      throw new ForbiddenException('You can only log breaks on your own shift');
    }

    const breakRecord = {
      id: randomUUID(),
      type: dto.type,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      notes: dto.notes ?? null,
    };

    shift.breaks = [...(shift.breaks ?? []), breakRecord];
    await this.shiftRepo.save(shift);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName:
        actor.sub_type === 'admin'
          ? actor.email ?? 'Admin'
          : shift.staff
            ? `${shift.staff.firstName} ${shift.staff.lastName}`
            : 'Staff',
      action: 'shift.break_added',
      businessId: actor.businessId,
      storeId: shift.storeId,
      resourceType: 'shift',
      resourceId: shift.id,
      metadata: {
        breakId: breakRecord.id,
        type: breakRecord.type,
        durationMinutes: breakRecord.durationMinutes,
      },
    });

    return ShiftResponseDto.from(shift);
  }

  async deleteBreak(
    shiftId: string,
    breakId: string,
    actor: JwtPayload,
  ): Promise<ShiftResponseDto> {
    const shift = await this.findEntityWithRelations(shiftId);

    if (actor.sub_type === 'staff' && shift.staffId !== actor.sub) {
      throw new ForbiddenException('You can only remove breaks on your own shift');
    }

    const before = shift.breaks ?? [];
    const after = before.filter((b) => b.id !== breakId);
    if (after.length === before.length) {
      throw new NotFoundException('Break not found on this shift');
    }
    shift.breaks = after;
    await this.shiftRepo.save(shift);

    this.activityLog.record({
      actorType: actor.sub_type,
      actorId: actor.sub,
      actorName:
        actor.sub_type === 'admin'
          ? actor.email ?? 'Admin'
          : shift.staff
            ? `${shift.staff.firstName} ${shift.staff.lastName}`
            : 'Staff',
      action: 'shift.break_removed',
      businessId: actor.businessId,
      storeId: shift.storeId,
      resourceType: 'shift',
      resourceId: shift.id,
      metadata: { breakId },
    });

    return ShiftResponseDto.from(shift);
  }
}
