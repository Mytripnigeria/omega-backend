import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComboEntity } from './entities/combo.entity';
import { ComboItemEntity } from './entities/combo-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CombosService } from './combos.service';
import { CombosController } from './combos.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComboEntity, ComboItemEntity, ProductEntity]),
    StorageModule,
  ],
  controllers: [CombosController],
  providers: [CombosService],
  exports: [CombosService],
})
export class CombosModule {}
