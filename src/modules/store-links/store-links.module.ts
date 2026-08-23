import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreLinkEntity } from './entities/store-link.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { StoreLinksService } from './store-links.service';
import { StoreLinksController } from './store-links.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreLinkEntity, StoreEntity]),
    ActivityLogModule,
  ],
  controllers: [StoreLinksController],
  providers: [StoreLinksService],
  exports: [StoreLinksService],
})
export class StoreLinksModule {}
