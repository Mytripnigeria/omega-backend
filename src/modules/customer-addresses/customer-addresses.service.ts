import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerAddressEntity } from './entities/customer-address.entity';
import {
  CreateCustomerAddressDto,
  CustomerAddressResponseDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(CustomerAddressEntity)
    private readonly repo: Repository<CustomerAddressEntity>,
  ) {}

  async list(
    businessId: string,
    customerId: string,
  ): Promise<CustomerAddressResponseDto[]> {
    const rows = await this.repo.find({
      where: { businessId, customerId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(CustomerAddressResponseDto.from);
  }

  async findOne(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddressResponseDto> {
    return CustomerAddressResponseDto.from(
      await this.findEntity(businessId, customerId, id),
    );
  }

  private async findEntity(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerAddressEntity> {
    const r = await this.repo.findOne({
      where: { id, businessId, customerId },
    });
    if (!r) throw new NotFoundException('Address not found');
    return r;
  }

  async create(
    businessId: string,
    customerId: string,
    dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddressResponseDto> {
    if (dto.isDefault) {
      await this.repo.update(
        { businessId, customerId, isDefault: true },
        { isDefault: false },
      );
    }
    const existingCount = await this.repo.count({ where: { businessId, customerId } });
    const address = this.repo.create({
      ...dto,
      businessId,
      customerId,
      country: dto.country ?? 'Nigeria',
      isDefault: dto.isDefault ?? existingCount === 0,
    });
    return CustomerAddressResponseDto.from(await this.repo.save(address));
  }

  async update(
    businessId: string,
    customerId: string,
    id: string,
    dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddressResponseDto> {
    const address = await this.findEntity(businessId, customerId, id);
    if (dto.isDefault) {
      await this.repo.update(
        { businessId, customerId, isDefault: true },
        { isDefault: false },
      );
    }
    Object.assign(address, dto);
    return CustomerAddressResponseDto.from(await this.repo.save(address));
  }

  async remove(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<void> {
    const address = await this.findEntity(businessId, customerId, id);
    await this.repo.softRemove(address);
    if (address.isDefault) {
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
