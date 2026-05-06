import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerPaymentMethodEntity } from './entities/customer-payment-method.entity';
import {
  CreateCustomerPaymentMethodDto,
  CustomerPaymentMethodResponseDto,
  UpdateCustomerPaymentMethodDto,
} from './dto/customer-payment-method.dto';

@Injectable()
export class CustomerPaymentMethodsService {
  constructor(
    @InjectRepository(CustomerPaymentMethodEntity)
    private readonly repo: Repository<CustomerPaymentMethodEntity>,
  ) {}

  async list(
    businessId: string,
    customerId: string,
  ): Promise<CustomerPaymentMethodResponseDto[]> {
    const rows = await this.repo.find({
      where: { businessId, customerId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(CustomerPaymentMethodResponseDto.from);
  }

  async findEntityById(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerPaymentMethodEntity> {
    const r = await this.repo.findOne({ where: { id, businessId, customerId } });
    if (!r) throw new NotFoundException('Payment method not found');
    return r;
  }

  async create(
    businessId: string,
    customerId: string,
    dto: CreateCustomerPaymentMethodDto,
  ): Promise<CustomerPaymentMethodResponseDto> {
    const existing = await this.repo.findOne({
      where: { customerId, authorizationCode: dto.authorizationCode },
    });
    if (existing) throw new ConflictException('This card is already saved');

    if (dto.isDefault) {
      await this.repo.update(
        { businessId, customerId, isDefault: true },
        { isDefault: false },
      );
    }
    const count = await this.repo.count({ where: { businessId, customerId } });
    const method = this.repo.create({
      ...dto,
      businessId,
      customerId,
      cardholderName: dto.cardholderName ?? null,
      bin: dto.bin ?? null,
      bank: dto.bank ?? null,
      channel: dto.channel ?? null,
      isDefault: dto.isDefault ?? count === 0,
    });
    return CustomerPaymentMethodResponseDto.from(await this.repo.save(method));
  }

  async update(
    businessId: string,
    customerId: string,
    id: string,
    dto: UpdateCustomerPaymentMethodDto,
  ): Promise<CustomerPaymentMethodResponseDto> {
    const method = await this.findEntityById(businessId, customerId, id);
    if (dto.isDefault) {
      await this.repo.update(
        { businessId, customerId, isDefault: true },
        { isDefault: false },
      );
    }
    Object.assign(method, dto);
    return CustomerPaymentMethodResponseDto.from(await this.repo.save(method));
  }

  async remove(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<void> {
    const method = await this.findEntityById(businessId, customerId, id);
    await this.repo.softRemove(method);
    if (method.isDefault) {
      const next = await this.repo.findOne({
        where: { businessId, customerId },
        order: { createdAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await this.repo.save(next);
      }
    }
  }
}
