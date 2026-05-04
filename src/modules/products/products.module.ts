import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariationEntity } from './entities/product-variation.entity';
import { ProductIngredientEntity } from './entities/product-ingredient.entity';
import { AddOnGroupEntity } from '../addon-groups/entities/addon-group.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductVariationEntity,
      ProductIngredientEntity,
      AddOnGroupEntity,
    ]),
    StorageModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
