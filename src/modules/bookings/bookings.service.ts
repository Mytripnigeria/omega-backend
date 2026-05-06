import { Injectable } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { EventsService } from './events.service';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { EventResponseDto } from './dto/event-response.dto';

export interface CalendarFeedItem {
  kind: 'reservation' | 'event';
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  status: string;
  guests: number;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly events: EventsService,
  ) {}

  async getCombinedStats(businessId: string, storeId?: string) {
    const [r, e] = await Promise.all([
      this.reservations.getStats(businessId, storeId),
      this.events.getStats(businessId, storeId),
    ]);
    return {
      totalReservations: r.totalReservations,
      todayReservations: r.todayReservations,
      upcomingReservations: r.upcomingReservations,
      cancelledReservations: r.cancelledReservations,
      noShowRate: r.noShowRate,
      totalEvents: e.totalEvents,
      upcomingEvents: e.upcomingEvents,
      inProgressEvents: e.inProgressEvents,
      expectedRevenue: e.expectedRevenue,
      collectedRevenue: e.collectedRevenue,
    };
  }

  async getCalendar(
    businessId: string,
    dateFrom: string,
    dateTo: string,
    storeId?: string,
  ): Promise<{
    reservations: ReservationResponseDto[];
    events: EventResponseDto[];
    feed: CalendarFeedItem[];
  }> {
    const [reservationEntities, eventEntities] = await Promise.all([
      this.reservations.findForRange(businessId, storeId, dateFrom, dateTo),
      this.events.findForRange(businessId, storeId, dateFrom, dateTo),
    ]);

    const reservations = reservationEntities.map(ReservationResponseDto.from);
    const events = eventEntities.map(EventResponseDto.from);

    const feed: CalendarFeedItem[] = [
      ...reservations.map<CalendarFeedItem>((r) => ({
        kind: 'reservation',
        id: r.id,
        title: r.customerName,
        date: r.date,
        startTime: r.time,
        endTime: null,
        status: r.status,
        guests: r.partySize,
      })),
      ...events.map<CalendarFeedItem>((e) => ({
        kind: 'event',
        id: e.id,
        title: e.name,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        status: e.status,
        guests: e.confirmedGuests ?? e.expectedGuests,
      })),
    ].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.startTime.localeCompare(b.startTime);
    });

    return { reservations, events, feed };
  }
}
