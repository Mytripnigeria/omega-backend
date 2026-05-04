import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  @PrimaryColumn('uuid')
  adminId: string;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_CHANNELS)}'::jsonb` })
  channels: NotificationChannels;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_EVENTS)}'::jsonb` })
  events: NotificationEventToggles;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const NOTIFICATION_DEFAULTS = { channels: DEFAULT_CHANNELS, events: DEFAULT_EVENTS };
