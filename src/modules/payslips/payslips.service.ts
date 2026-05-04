import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayslipEntity, PayslipStatus } from './entities/payslip.entity';
import { PayslipAdjustmentEntity } from './entities/payslip-adjustment.entity';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { UpdatePayslipDto } from './dto/update-payslip.dto';
import { PayslipFilterDto } from './dto/payslip-filter.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

const VALID_TRANSITIONS: Record<PayslipStatus, PayslipStatus[]> = {
  [PayslipStatus.DRAFT]: [PayslipStatus.PENDING, PayslipStatus.CANCELLED],
  [PayslipStatus.PENDING]: [PayslipStatus.APPROVED, PayslipStatus.CANCELLED],
  [PayslipStatus.APPROVED]: [PayslipStatus.PAID, PayslipStatus.CANCELLED],
  [PayslipStatus.PAID]: [],
  [PayslipStatus.CANCELLED]: [],
};

@Injectable()
export class PayslipsService {
  constructor(
    @InjectRepository(PayslipEntity)
    private readonly payslipRepo: Repository<PayslipEntity>,
  ) {}

  private toResponseDto(p: PayslipEntity) {
    const additions = (p.adjustments ?? []).filter((a) => !a.isDeduction);
    const deductions = (p.adjustments ?? []).filter((a) => a.isDeduction);
    return {
      id: p.id,
      storeId: p.storeId,
      staffId: p.staffId,
      staffName: p.staff
        ? `${p.staff.firstName} ${p.staff.lastName}`
        : '',
      period: p.period,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      baseSalary: Number(p.baseSalary),
      hoursWorked: p.hoursWorked ? Number(p.hoursWorked) : null,
      overtimeHours: p.overtimeHours ? Number(p.overtimeHours) : null,
      overtimeRate: p.overtimeRate ? Number(p.overtimeRate) : null,
      additions: additions.map((a) => ({
        id: a.id,
        name: a.name,
        amount: Number(a.amount),
        type: a.type,
      })),
      deductions: deductions.map((a) => ({
        id: a.id,
        name: a.name,
        amount: Number(a.amount),
        type: a.type,
      })),
      grossPay: Number(p.grossPay),
      netPay: Number(p.netPay),
      status: p.status,
      paymentDate: p.paymentDate ?? null,
      paymentMethod: p.paymentMethod ?? null,
      receiptUrl: p.receiptUrl ?? null,
      notes: p.notes ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private computePayAmounts(
    baseSalary: number,
    overtimeHours: number,
    overtimeRate: number,
    adjustments: { amount: number; isDeduction: boolean }[],
  ) {
    const overtimePay = overtimeHours * overtimeRate;
    const additionsTotal = adjustments
      .filter((a) => !a.isDeduction)
      .reduce((sum, a) => sum + a.amount, 0);
    const deductionsTotal = adjustments
      .filter((a) => a.isDeduction)
      .reduce((sum, a) => sum + a.amount, 0);

    const grossPay = baseSalary + overtimePay + additionsTotal;
    const netPay = grossPay - deductionsTotal;
    return { grossPay, netPay };
  }

  async create(dto: CreatePayslipDto) {
    const adjustments = dto.adjustments ?? [];
    const { grossPay, netPay } = this.computePayAmounts(
      dto.baseSalary,
      dto.overtimeHours ?? 0,
      dto.overtimeRate ?? 0,
      adjustments,
    );

    const payslip = this.payslipRepo.create({
      ...dto,
      grossPay,
      netPay,
      adjustments: adjustments as PayslipAdjustmentEntity[],
    });

    const saved = await this.payslipRepo.save(payslip);
    return this.findOneInternal(saved.id);
  }

  async findAll(filter: PayslipFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.payslipRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.staff', 'staff')
      .leftJoinAndSelect('p.adjustments', 'adjustments')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC');

    if (filter.storeId) qb.andWhere('p.storeId = :storeId', { storeId: filter.storeId });
    if (filter.staffId) qb.andWhere('p.staffId = :staffId', { staffId: filter.staffId });
    if (filter.status) qb.andWhere('p.status = :status', { status: filter.status });
    if (filter.period) qb.andWhere('p.period = :period', { period: filter.period });
    if (filter.periodFrom) qb.andWhere('p.periodStart >= :periodFrom', { periodFrom: filter.periodFrom });
    if (filter.periodTo) qb.andWhere('p.periodEnd <= :periodTo', { periodTo: filter.periodTo });

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.of(
      data.map((p) => this.toResponseDto(p)),
      total,
      page,
      limit,
    );
  }

  private async findOneInternal(id: string): Promise<ReturnType<typeof this.toResponseDto>> {
    const payslip = await this.payslipRepo.findOne({
      where: { id },
      relations: ['staff', 'adjustments'],
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return this.toResponseDto(payslip);
  }

  async findOne(id: string) {
    return this.findOneInternal(id);
  }

  async findMyPayslips(staffId: string, filter: PayslipFilterDto) {
    return this.findAll({ ...filter, staffId });
  }

  async update(id: string, dto: UpdatePayslipDto) {
    const payslip = await this.payslipRepo.findOne({
      where: { id },
      relations: ['adjustments'],
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.status !== PayslipStatus.DRAFT) {
      throw new BadRequestException('Only draft payslips can be edited');
    }

    const adjustments = dto.adjustments ?? payslip.adjustments;
    const { grossPay, netPay } = this.computePayAmounts(
      dto.baseSalary ?? Number(payslip.baseSalary),
      dto.overtimeHours ?? Number(payslip.overtimeHours) ?? 0,
      dto.overtimeRate ?? Number(payslip.overtimeRate) ?? 0,
      adjustments as { amount: number; isDeduction: boolean }[],
    );

    Object.assign(payslip, { ...dto, grossPay, netPay });
    await this.payslipRepo.save(payslip);
    return this.findOneInternal(id);
  }

  async remove(id: string): Promise<void> {
    const payslip = await this.payslipRepo.findOne({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.status !== PayslipStatus.DRAFT) {
      throw new BadRequestException('Only draft payslips can be deleted');
    }
    await this.payslipRepo.delete(id);
  }

  private async transition(id: string, targetStatus: PayslipStatus) {
    const payslip = await this.payslipRepo.findOne({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');

    const allowed = VALID_TRANSITIONS[payslip.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${payslip.status} to ${targetStatus}`,
      );
    }

    payslip.status = targetStatus;
    await this.payslipRepo.save(payslip);
    return this.findOneInternal(id);
  }

  async approve(id: string) {
    return this.transition(id, PayslipStatus.APPROVED);
  }

  async markPaid(id: string, dto: MarkPaidDto) {
    const payslip = await this.payslipRepo.findOne({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');

    if (payslip.status !== PayslipStatus.APPROVED) {
      throw new BadRequestException('Only approved payslips can be marked as paid');
    }

    Object.assign(payslip, {
      status: PayslipStatus.PAID,
      paymentDate: dto.paymentDate,
      paymentMethod: dto.paymentMethod,
      receiptUrl: dto.receiptUrl,
    });

    await this.payslipRepo.save(payslip);
    return this.findOneInternal(id);
  }
}
