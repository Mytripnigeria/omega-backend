import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreEntity } from '../../modules/store/entities/store.entity';

/**
 * Helper for any controller that takes a `storeId` parameter and needs to verify
 * the store belongs to the caller's business. Centralized so the rule is enforced uniformly.
 */
@Injectable()
export class StoreScopeService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
  ) {}

  async assertStoreInBusiness(storeId: string, businessId: string): Promise<StoreEntity> {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    if (store.businessId !== businessId) {
      throw new ForbiddenException('Store does not belong to your business');
    }
    return store;
  }
}
