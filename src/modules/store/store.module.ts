import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreEntity } from './entities/store.entity';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { StoreScopeService } from '../../common/services/store-scope.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreEntity])],
  controllers: [StoreController],
  providers: [StoreService, StoreScopeService],
  exports: [StoreService, StoreScopeService, TypeOrmModule],
})
export class StoreModule {}
