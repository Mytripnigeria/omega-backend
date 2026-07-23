import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PinLength {
  FOUR = 4,
  SIX = 6,
  EIGHT = 8,
}

@Entity('workstation_settings')
export class WorkstationSettingsEntity {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @PrimaryColumn('uuid')
  businessId: string;

  // ---------- Authentication ----------
  @ApiProperty({ enum: [4, 6, 8], example: 4, default: 4 })
  @Column({ type: 'int', default: 4 })
  pinLength: number;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  requirePinRotation: boolean;

  @ApiProperty({ example: 30, default: 30, description: 'Days before staff must rotate PIN' })
  @Column({ type: 'int', default: 30 })
  pinRotationDays: number;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  allowPinRecovery: boolean;

  @ApiProperty({ example: 5, default: 5 })
  @Column({ type: 'int', default: 5 })
  lockOnFailedAttempts: number;

  // ---------- Display ----------
  @ApiProperty({ example: 15, default: 15, description: 'Idle minutes before screen lock' })
  @Column({ type: 'int', default: 15 })
  screenTimeoutMinutes: number;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  showClock: boolean;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  darkModeDefault: boolean;

  // ---------- Shifts ----------
  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'Auto-clock-out a shift after this many hours. Null disables auto clock-out.',
  })
  @Column({ type: 'int', nullable: true })
  autoClockOutHours: number | null;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  requireBreakLogging: boolean;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  allowShiftSwap: boolean;

  @ApiProperty({ example: 15, default: 15 })
  @Column({ type: 'int', default: 15 })
  minBreakMinutes: number;

  // ---------- Notifications ----------
  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  newOrderSound: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  lowStockAlerts: boolean;

  @ApiProperty({ example: 70, default: 70, minimum: 0, maximum: 100 })
  @Column({ type: 'int', default: 70 })
  notificationVolume: number;

  // ---------- Access control ----------
  @ApiProperty({
    example: false,
    default: false,
    description:
      'When true, new orders from every channel are auto-accepted (INITIATED → ' +
      'PENDING) instead of waiting for a cashier to Accept them in the counter POS.',
  })
  @Column({ default: false })
  autoAcceptOrders: boolean;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  managerOverrideRequired: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  voidRequiresManager: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  refundRequiresManager: boolean;

  // ---------- Printing ----------
  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  autoPrintKitchenTickets: boolean;

  @ApiProperty({ example: true, default: true })
  @Column({ default: true })
  autoPrintReceipt: boolean;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  autoPrintShiftSummary: boolean;

  // ---------- Permissions / advanced ----------
  @ApiProperty({
    type: [String],
    example: ['orders:create', 'orders:edit'],
    description: 'Default permissions granted to new staff users',
  })
  @Column({ type: 'simple-array', default: '' })
  defaultPermissions: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    nullable: true,
    example: { counter_pos: ['Cashier'], instore: ['Manager', 'Supervisor'] },
    description:
      'Maps each workstation function (counter_pos, self_service, kitchen, ' +
      'waiter, delivery, lobby, instore, outstore, expenses, managers) to the ' +
      'role names allowed to access it. Empty/absent for a function = all roles.',
  })
  @Column({ type: 'jsonb', nullable: true })
  functionRoleAccess: Record<string, string[]> | null;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  offlineModeEnabled: boolean;

  @ApiProperty({ example: 5, default: 5 })
  @Column({ type: 'int', default: 5 })
  autoSyncMinutes: number;

  // --- Geofencing: restrict staff login / clock-in to the work environment ---
  @ApiProperty({
    example: false,
    default: false,
    description: 'When on, staff can only log in / clock in within the geofence.',
  })
  @Column({ default: false })
  geofenceEnabled: boolean;

  @ApiPropertyOptional({
    nullable: true,
    example: 6.5244,
    description: 'Geofence centre latitude.',
  })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  geofenceLatitude: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 3.3792,
    description: 'Geofence centre longitude.',
  })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  geofenceLongitude: number | null;

  @ApiProperty({
    example: 100,
    default: 100,
    description: 'Geofence radius in metres.',
  })
  @Column({ type: 'int', default: 100 })
  geofenceRadiusMeters: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
