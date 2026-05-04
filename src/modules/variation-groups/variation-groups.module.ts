import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VariationGroupEntity } from './entities/variation-group.entity';
import { VariationOptionEntity } from './entities/variation-option.entity';
import { VariationGroupsService } from './variation-groups.service';
import { VariationGroupsController } from './variation-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VariationGroupEntity, VariationOptionEntity])],
  controllers: [VariationGroupsController],
  providers: [VariationGroupsService],
  exports: [VariationGroupsService],
})
export class VariationGroupsModule {}
