import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddOnGroupEntity } from './entities/addon-group.entity';
import { AddOnEntity } from './entities/addon.entity';
import { AddonIngredientEntity } from './entities/addon-ingredient.entity';
import { AddOnGroupsService } from './addon-groups.service';
import { AddOnGroupsController } from './addon-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AddOnGroupEntity, AddOnEntity, AddonIngredientEntity])],
  controllers: [AddOnGroupsController],
  providers: [AddOnGroupsService],
  exports: [AddOnGroupsService],
})
export class AddOnGroupsModule {}
