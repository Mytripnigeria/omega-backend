import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterEntity } from './entities/printer.entity';
import { PrintersService } from './printers.service';
import { PrintersController } from './printers.controller';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterEntity]), StoreModule],
  controllers: [PrintersController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
