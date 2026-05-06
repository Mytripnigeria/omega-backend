import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CouponEntity,
  CouponRedemptionEntity,
  CouponType,
} from './entities/coupon.entity';
import {
  CouponFilterDto,
  CouponResponseDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponResponseDto,
} from './dto/coupon.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

interface ApplyCouponResult {
  coupon: CouponEntity;
  discountAmount: number;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepo: Repository<CouponEntity>,
    @InjectRepository(CouponRedemptionEntity)
    private readonly redemptionRepo: Repository<CouponRedemptionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    businessId: string,
    filter: CouponFilterDto,
  ): Promise<PaginatedResponseDto<CouponResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.couponRepo
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC');
    if (filter.isActive !== undefined)
      qb.andWhere('c.isActive = :a', { a: filter.isActive });
    if (filter.search)
      qb.andWhere('(c.code ILIKE :q OR c.description ILIKE :q)', {
        q: `%${filter.search}%`,
      });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit, CouponResponseDto.from);
  }

  async findOne(businessId: string, id: string): Promise<CouponResponseDto> {
    return CouponResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(
    businessId: string,
    id: string,
  ): Promise<CouponEntity> {
    const c = await this.couponRepo.findOne({ where: { id, businessId } });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }

  async create(
    businessId: string,
    dto: CreateCouponDto,
  ): Promise<CouponResponseDto> {
    const upperCode = dto.code.toUpperCase();
    const existing = await this.couponRepo.findOne({
      where: { businessId, code: upperCode },
    });
    if (existing) throw new ConflictException('Coupon code already exists');

    if (dto.type === CouponType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('Percentage cannot exceed 100');
    }

    const coupon = this.couponRepo.create({
      ...dto,
      code: upperCode,
      businessId,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
    });
    return CouponResponseDto.from(await this.couponRepo.save(coupon));
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    const coupon = await this.findEntity(businessId, id);
    if (dto.code) {
      const upperCode = dto.code.toUpperCase();
      if (upperCode !== coupon.code) {
        const conflict = await this.couponRepo.findOne({
          where: { businessId, code: upperCode },
        });
        if (conflict) throw new ConflictException('Coupon code already exists');
        coupon.code = upperCode;
      }
    }
    Object.assign(coupon, { ...dto, code: coupon.code });
    if (dto.startsAt !== undefined)
      coupon.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      coupon.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    return CouponResponseDto.from(await this.couponRepo.save(coupon));
  }

  async remove(businessId: string, id: string): Promise<void> {
    const coupon = await this.findEntity(businessId, id);
    await this.couponRepo.softRemove(coupon);
  }

  async validate(
    businessId: string,
    customerId: string | null,
    code: string,
    subtotal: number,
  ): Promise<ValidateCouponResponseDto> {
    const upperCode = code.trim().toUpperCase();
    const coupon = await this.couponRepo.findOne({
      where: { businessId, code: upperCode },
    });
    if (!coupon || !coupon.isActive) {
      return { valid: false, reason: 'Invalid coupon code' };
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, reason: 'Coupon is not yet active' };
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      return { valid: false, reason: 'Coupon has expired' };
    }
    if (
      coupon.usageLimit != null &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }
    if (
      coupon.minOrderAmount != null &&
      Number(subtotal) < Number(coupon.minOrderAmount)
    ) {
      return {
        valid: false,
        reason: `Minimum order amount is ₦${Number(coupon.minOrderAmount).toLocaleString()}`,
      };
    }
    if (customerId && coupon.perCustomerLimit != null) {
      const used = await this.redemptionRepo.count({
        where: { couponId: coupon.id, customerId },
      });
      if (used >= coupon.perCustomerLimit) {
        return { valid: false, reason: 'You have already used this coupon' };
      }
    }

    const discountAmount = this.computeDiscount(coupon, subtotal);

    return {
      valid: true,
      coupon: CouponResponseDto.from(coupon),
      discountAmount,
    };
  }

  /**
   * Atomically reserve a coupon for redemption: validates, increments usageCount,
   * and writes a redemption record. Returns the discount amount.
   */
  async redeem(
    businessId: string,
    customerId: string,
    code: string,
    subtotal: number,
    orderId: string | null,
  ): Promise<ApplyCouponResult> {
    return this.dataSource.transaction(async (mgr) => {
      const upperCode = code.trim().toUpperCase();
      const coupon = await mgr
        .getRepository(CouponEntity)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.businessId = :businessId AND c.code = :code', {
          businessId,
          code: upperCode,
        })
        .getOne();
      if (!coupon || !coupon.isActive) {
        throw new BadRequestException('Invalid coupon code');
      }
      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now)
        throw new BadRequestException('Coupon is not yet active');
      if (coupon.endsAt && coupon.endsAt < now)
        throw new BadRequestException('Coupon has expired');
      if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit)
        throw new BadRequestException('Coupon usage limit reached');
      if (
        coupon.minOrderAmount != null &&
        Number(subtotal) < Number(coupon.minOrderAmount)
      ) {
        throw new BadRequestException(
          `Minimum order amount is ₦${Number(coupon.minOrderAmount).toLocaleString()}`,
        );
      }
      if (coupon.perCustomerLimit != null) {
        const used = await mgr
          .getRepository(CouponRedemptionEntity)
          .count({ where: { couponId: coupon.id, customerId } });
        if (used >= coupon.perCustomerLimit) {
          throw new BadRequestException('You have already used this coupon');
        }
      }

      const discountAmount = this.computeDiscount(coupon, subtotal);

      coupon.usageCount += 1;
      await mgr.getRepository(CouponEntity).save(coupon);

      await mgr.getRepository(CouponRedemptionEntity).save(
        mgr.getRepository(CouponRedemptionEntity).create({
          couponId: coupon.id,
          customerId,
          orderId: orderId ?? null,
          discountAmount,
        }),
      );

      return { coupon, discountAmount };
    });
  }

  private computeDiscount(coupon: CouponEntity, subtotal: number): number {
    if (coupon.type === CouponType.PERCENTAGE) {
      const raw = (Number(subtotal) * Number(coupon.value)) / 100;
      const capped =
        coupon.maxDiscount != null
          ? Math.min(raw, Number(coupon.maxDiscount))
          : raw;
      return Math.round(capped * 100) / 100;
    }
    return Math.min(Number(coupon.value), Number(subtotal));
  }
}
