import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PayslipEntity, PayslipStatus } from './entities/payslip.entity';
import { PayslipAdjustmentEntity } from './entities/payslip-adjustment.entity';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { UpdatePayslipDto } from './dto/update-payslip.dto';
import { PayslipFilterDto } from './dto/payslip-filter.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { PayslipResponseDto } from './dto/payslip-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

// Approving a payslip directly from draft is the merchant's primary workflow
// (no separate "submit for approval" step in the hub UI). PENDING stays in the
// machine so existing rows can still flow through; both DRAFT→APPROVED and
// PENDING→APPROVED are valid entry points.
const VALID_TRANSITIONS: Record<PayslipStatus, PayslipStatus[]> = {
  [PayslipStatus.DRAFT]: [
    PayslipStatus.PENDING,
    PayslipStatus.APPROVED,
    PayslipStatus.CANCELLED,
  ],
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
    @InjectRepository(PayslipAdjustmentEntity)
    private readonly adjustmentRepo: Repository<PayslipAdjustmentEntity>,
    private readonly dataSource: DataSource,
  ) {}

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

  async create(dto: CreatePayslipDto): Promise<PayslipResponseDto> {
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
    return this.findOne(saved.id);
  }

  async findAll(filter: PayslipFilterDto): Promise<PaginatedResponseDto<PayslipResponseDto>> {
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
    return paginate(data, total, page, limit, PayslipResponseDto.from);
  }

  async findOne(id: string): Promise<PayslipResponseDto> {
    return PayslipResponseDto.from(await this.findEntityWithRelations(id));
  }

  private async findEntityWithRelations(id: string): Promise<PayslipEntity> {
    const payslip = await this.payslipRepo.findOne({
      where: { id },
      relations: ['staff', 'adjustments'],
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return payslip;
  }

  async findMyPayslips(staffId: string, filter: PayslipFilterDto): Promise<PaginatedResponseDto<PayslipResponseDto>> {
    return this.findAll({ ...filter, staffId });
  }

  async update(id: string, dto: UpdatePayslipDto): Promise<PayslipResponseDto> {
    // Adjustments are managed by their own repo to avoid the cascade-replace
    // trap: the previous implementation overwrote payslip.adjustments with raw
    // DTO objects via Object.assign, which TypeORM's cascade save couldn't
    // reconcile against the loaded child rows — sometimes failing with a 500
    // depending on driver behaviour. Doing it explicitly is boring but safe.
    return this.dataSource.transaction(async (m) => {
      const payslipRepo = m.getRepository(PayslipEntity);
      const adjustmentRepo = m.getRepository(PayslipAdjustmentEntity);

      const payslip = await payslipRepo.findOne({
        where: { id },
        relations: ['adjustments'],
      });
      if (!payslip) throw new NotFoundException('Payslip not found');
      if (payslip.status !== PayslipStatus.DRAFT) {
        throw new BadRequestException('Only draft payslips can be edited');
      }

      // Split adjustments out and apply only scalar fields to the entity.
      // (Object.assign(payslip, {...dto}) for adjustments is what caused the
      // 500; we explicitly exclude it here.)
      const { adjustments: dtoAdjustments, ...scalarPatch } = dto;
      Object.assign(payslip, scalarPatch);

      let effectiveAdjustments: { amount: number; isDeduction: boolean }[];
      if (dtoAdjustments !== undefined) {
        // Replace the entire adjustment set. Detach the loaded relation so
        // the upcoming payslip save doesn't cascade against stale entities.
        payslip.adjustments = [];
        await adjustmentRepo.delete({ payslipId: id });
        const newRows = dtoAdjustments.map((a) =>
          adjustmentRepo.create({
            payslipId: id,
            name: a.name,
            amount: a.amount,
            type: a.type,
            isDeduction: a.isDeduction,
          }),
        );
        if (newRows.length > 0) await adjustmentRepo.save(newRows);
        effectiveAdjustments = newRows.map((r) => ({
          amount: Number(r.amount),
          isDeduction: r.isDeduction,
        }));
      } else {
        effectiveAdjustments = payslip.adjustments.map((r) => ({
          amount: Number(r.amount),
          isDeduction: r.isDeduction,
        }));
        // Same reason as above: detach so cascade save doesn't try to re-save
        // these rows we just left untouched.
        payslip.adjustments = [];
      }

      const { grossPay, netPay } = this.computePayAmounts(
        Number(payslip.baseSalary),
        Number(payslip.overtimeHours ?? 0),
        Number(payslip.overtimeRate ?? 0),
        effectiveAdjustments,
      );
      payslip.grossPay = grossPay;
      payslip.netPay = netPay;

      await payslipRepo.save(payslip);
      return this.findOne(id);
    });
  }

  async remove(id: string): Promise<void> {
    const payslip = await this.payslipRepo.findOne({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.status !== PayslipStatus.DRAFT) {
      throw new BadRequestException('Only draft payslips can be deleted');
    }
    await this.payslipRepo.delete(id);
  }

  private async transition(id: string, targetStatus: PayslipStatus): Promise<PayslipResponseDto> {
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
    return this.findOne(id);
  }

  async approve(id: string): Promise<PayslipResponseDto> {
    return this.transition(id, PayslipStatus.APPROVED);
  }

  async markPaid(id: string, dto: MarkPaidDto): Promise<PayslipResponseDto> {
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
    return this.findOne(id);
  }
}
