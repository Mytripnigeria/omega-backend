import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationPreferenceEntity,
  NOTIFICATION_DEFAULTS,
} from './entities/notification-preference.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly repo: Repository<NotificationPreferenceEntity>,
  ) {}

  async get(adminId: string): Promise<NotificationPreferenceEntity> {
    let pref = await this.repo.findOne({ where: { adminId } });
    if (!pref) {
      pref = this.repo.create({
        adminId,
        channels: { ...NOTIFICATION_DEFAULTS.channels },
        events: { ...NOTIFICATION_DEFAULTS.events },
      });
      pref = await this.repo.save(pref);
    }
    return pref;
  }

  async update(
    adminId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceEntity> {
    const pref = await this.get(adminId);
    if (dto.channels) pref.channels = { ...pref.channels, ...dto.channels };
    if (dto.events) pref.events = { ...pref.events, ...dto.events };
    return this.repo.save(pref);
  }
}
