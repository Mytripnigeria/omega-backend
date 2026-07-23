import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export interface NotificationChannels {
  email: boolean;
  sms: boolean;
  push: boolean;
  doNotDisturb: boolean;
}

export interface NotificationEventToggles {
  newOrder: boolean;
  newCustomer: boolean;
  lowStock: boolean;
  dailyReport: boolean;
  paymentReceived: boolean;
  shiftReminder: boolean;
}

const DEFAULT_CHANNELS: NotificationChannels = {
  email: true,
  sms: false,
  push: true,
  doNotDisturb: false,
};

const DEFAULT_EVENTS: NotificationEventToggles = {
  newOrder: true,
  newCustomer: false,
  lowStock: true,
  dailyReport: true,
  paymentReceived: true,
  shiftReminder: false,
};

@Entity('notification_preferences')
export class NotificationPreferenceEntity {
  @ApiProperty({ format: 'uuid', example: '3a1b2c3d-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryColumn('uuid')
  adminId: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { email: true, sms: false, push: true, doNotDisturb: false },
    description: 'Delivery channel preferences. `doNotDisturb` disables all channels during quiet hours.',
  })
  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_CHANNELS)}'::jsonb` })
  channels: NotificationChannels;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      newOrder: true,
      newCustomer: false,
      lowStock: true,
      dailyReport: true,
      paymentReceived: true,
      shiftReminder: false,
    },
    description: 'Per-event notification toggles.',
  })
  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_EVENTS)}'::jsonb` })
  events: NotificationEventToggles;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export const NOTIFICATION_DEFAULTS = { channels: DEFAULT_CHANNELS, events: DEFAULT_EVENTS };
