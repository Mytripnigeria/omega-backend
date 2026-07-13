import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistEntity } from './entities/checklist.entity';
import { ChecklistCompletionEntity } from './entities/checklist-completion.entity';
import { StaffEntity } from '../staff/entities/staff.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChecklistEntity,
      ChecklistCompletionEntity,
      StaffEntity,
      RoleEntity,
    ]),
  ],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
