import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderReviewEntity } from './entities/order-review.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsController,
  PublicReviewsController,
  StorefrontOrderReviewController,
} from './reviews.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderReviewEntity, OrderEntity, CustomerEntity]),
  ],
  controllers: [
    AdminReviewsController,
    StorefrontOrderReviewController,
    PublicReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
