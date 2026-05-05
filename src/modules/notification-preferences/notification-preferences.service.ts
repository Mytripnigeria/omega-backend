import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationPreferenceEntity,
  NOTIFICATION_DEFAULTS,
} from './entities/notification-preference.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferenceResponseDto } from './dto/notification-preference-response.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly repo: Repository<NotificationPreferenceEntity>,
  ) {}

  async get(adminId: string): Promise<NotificationPreferenceResponseDto> {
    return NotificationPreferenceResponseDto.from(await this.getEntity(adminId));
  }

  private async getEntity(adminId: string): Promise<NotificationPreferenceEntity> {
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
  ): Promise<NotificationPreferenceResponseDto> {
    const pref = await this.getEntity(adminId);
    if (dto.channels) pref.channels = { ...pref.channels, ...definedOnly(dto.channels) };
    if (dto.events) pref.events = { ...pref.events, ...definedOnly(dto.events) };
    const saved = await this.repo.save(pref);
    return NotificationPreferenceResponseDto.from(saved);
  }
}

// `class-transformer` materialises every declared @IsOptional field as an own
// property with value `undefined` when the request body omits it. Spreading
// that into `pref.channels` overwrites existing keys with undefined, and
// `JSON.stringify` then drops them on the way to jsonb — which loses unrelated
// toggles. Strip undefined keys before merging to preserve them.
function definedOnly<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (result as Record<string, unknown>)[k] = v;
  }
  return result;
}
