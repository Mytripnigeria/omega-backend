import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import {
  ReorderPaymentMethodsDto,
  UpdatePaymentMethodDto,
} from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethodEntity)
    private readonly repo: Repository<PaymentMethodEntity>,
  ) {}

  list(businessId: string): Promise<PaymentMethodEntity[]> {
    return this.repo.find({
      where: { businessId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<PaymentMethodEntity> {
    const method = await this.repo.findOne({ where: { id, businessId } });
    if (!method) throw new NotFoundException(`Payment method ${id} not found`);
    return method;
  }

  async create(businessId: string, dto: CreatePaymentMethodDto): Promise<PaymentMethodEntity> {
    const method = this.repo.create({ ...dto, businessId });
    return this.repo.save(method);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodEntity> {
    const method = await this.findOne(businessId, id);
    Object.assign(method, dto);
    return this.repo.save(method);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.repo.softDelete(id);
  }

  async reorder(businessId: string, dto: ReorderPaymentMethodsDto): Promise<void> {
    const ids = dto.items.map((it) => it.id);
    if (ids.length === 0) return;
    const found = await this.repo.count({
      where: ids.map((id) => ({ id, businessId })),
    });
    if (found !== ids.length) {
      throw new NotFoundException('One or more payment methods not found in your business');
    }
    await Promise.all(
      dto.items.map(({ id, order }) => this.repo.update(id, { order })),
    );
  }
}
