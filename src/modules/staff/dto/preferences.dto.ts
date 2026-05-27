import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

/**
 * Client-side preferences for the workstation app. Stored as JSON on
 * `StaffEntity.preferences`, validated against this whitelist on every write
 * so we never accept stray keys (anti-XSS for any JSON consumer down the line).
 */
export class StaffPreferencesDto {
  @ApiProperty({
    example: true,
    description: 'Play a beep sound on POS interactions (add to cart, order create, etc.).',
  })
  @Expose()
  beepEnabled: boolean;

  @ApiProperty({
    enum: ['light', 'dark', 'system'],
    example: 'system',
    description: 'Theme override for the workstation app. "system" follows OS preference.',
  })
  @Expose()
  theme: 'light' | 'dark' | 'system';

  @ApiProperty({
    example: true,
    description: 'Receive push notifications for new orders / status changes (where supported).',
  })
  @Expose()
  notificationsEnabled: boolean;
}

export class UpdateStaffPreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  beepEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export const STAFF_PREFERENCE_DEFAULTS: StaffPreferencesDto = {
  beepEnabled: true,
  theme: 'system',
  notificationsEnabled: true,
};

/**
 * Merges the stored preferences blob (could be partial, null, or polluted with
 * stale keys) onto the canonical defaults, dropping any keys we don't recognise.
 */
export function mergeStaffPreferences(
  stored: Record<string, unknown> | null | undefined,
): StaffPreferencesDto {
  const merged: StaffPreferencesDto = { ...STAFF_PREFERENCE_DEFAULTS };
  if (stored && typeof stored === 'object') {
    if (typeof stored.beepEnabled === 'boolean') merged.beepEnabled = stored.beepEnabled;
    if (stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system') {
      merged.theme = stored.theme;
    }
    if (typeof stored.notificationsEnabled === 'boolean') {
      merged.notificationsEnabled = stored.notificationsEnabled;
    }
  }
  return plainToInstance(StaffPreferencesDto, merged, { excludeExtraneousValues: true });
}
