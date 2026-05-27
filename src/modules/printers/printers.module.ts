import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterEntity } from './entities/printer.entity';
import { PrintJobEntity } from './entities/print-job.entity';
import { PrintersService } from './printers.service';
import { PrintersController } from './printers.controller';
import { EscPosSender } from './print/esc-pos-sender';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterEntity, PrintJobEntity]), StoreModule],
  controllers: [PrintersController],
  providers: [PrintersService, EscPosSender],
  exports: [PrintersService],
})
export class PrintersModule {}
