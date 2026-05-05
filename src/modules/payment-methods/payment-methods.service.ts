import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import {
  ReorderPaymentMethodsDto,
  UpdatePaymentMethodDto,
} from './dto/update-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethodEntity)
    private readonly repo: Repository<PaymentMethodEntity>,
  ) {}

  async list(businessId: string): Promise<PaymentMethodResponseDto[]> {
    const items = await this.repo.find({
      where: { businessId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    return PaymentMethodResponseDto.fromMany(items);
  }

  async findOne(businessId: string, id: string): Promise<PaymentMethodResponseDto> {
    return PaymentMethodResponseDto.from(await this.findEntity(businessId, id));
  }

  private async findEntity(businessId: string, id: string): Promise<PaymentMethodEntity> {
    const method = await this.repo.findOne({ where: { id, businessId } });
    if (!method) throw new NotFoundException(`Payment method ${id} not found`);
    return method;
  }

  async create(businessId: string, dto: CreatePaymentMethodDto): Promise<PaymentMethodResponseDto> {
    const method = this.repo.create({ ...dto, businessId });
    const saved = await this.repo.save(method);
    return PaymentMethodResponseDto.from(saved);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const method = await this.findEntity(businessId, id);
    Object.assign(method, dto);
    const saved = await this.repo.save(method);
    return PaymentMethodResponseDto.from(saved);
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findEntity(businessId, id);
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
