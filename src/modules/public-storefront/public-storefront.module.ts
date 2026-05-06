import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { ComboEntity } from '../combos/entities/combo.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { PublicMenuController } from './public-menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      CategoryEntity,
      ComboEntity,
      StoreEntity,
    ]),
  ],
  controllers: [PublicMenuController],
})
export class PublicStorefrontModule {}
