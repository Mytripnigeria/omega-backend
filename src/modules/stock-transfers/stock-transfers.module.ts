import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransferEntity } from './entities/stock-transfer.entity';
import { StockTransferItemEntity } from './entities/stock-transfer-item.entity';
import { IngredientEntity } from '../ingredients/entities/ingredient.entity';
import { IngredientLocationStockEntity } from '../ingredients/entities/ingredient-location-stock.entity';
import { InventoryLocationEntity } from '../inventory-locations/entities/inventory-location.entity';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfersController } from './stock-transfers.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockTransferEntity,
      StockTransferItemEntity,
      IngredientEntity,
      IngredientLocationStockEntity,
      InventoryLocationEntity,
    ]),
    ActivityLogModule,
  ],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}
