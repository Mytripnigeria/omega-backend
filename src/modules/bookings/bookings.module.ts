import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationEntity } from './entities/reservation.entity';
import { EventEntity } from './entities/event.entity';
import { ReservationsService } from './reservations.service';
import { EventsService } from './events.service';
import { BookingsService } from './bookings.service';
import { ReservationsController } from './reservations.controller';
import { EventsController } from './events.controller';
import { BookingsController } from './bookings.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReservationEntity, EventEntity]),
    ActivityLogModule,
  ],
  controllers: [ReservationsController, EventsController, BookingsController],
  providers: [ReservationsService, EventsService, BookingsService],
  exports: [ReservationsService, EventsService, BookingsService],
})
export class BookingsModule {}
