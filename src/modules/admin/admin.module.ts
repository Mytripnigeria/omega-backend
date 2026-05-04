import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminEntity } from './entities/admin.entity';
import { AdminService } from './admin.service';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [TypeOrmModule.forFeature([AdminEntity]), BusinessModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
