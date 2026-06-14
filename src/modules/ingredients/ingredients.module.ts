import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientEntity } from './entities/ingredient.entity';
import { IngredientMovementEntity } from './entities/ingredient-movement.entity';
import { IngredientLocationStockEntity } from './entities/ingredient-location-stock.entity';
import { InventoryLocationEntity } from '../inventory-locations/entities/inventory-location.entity';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngredientEntity,
      IngredientMovementEntity,
      IngredientLocationStockEntity,
      InventoryLocationEntity,
    ]),
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
