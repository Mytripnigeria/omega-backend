import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { WorkstationSettingsEntity } from '../entities/workstation-settings.entity';

export class WorkstationSettingsResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b1f1d2c0-1234-4f1a-8c3e-9a4f0c4e2b21' })
  @Expose()
  businessId: string;

  @ApiProperty({ enum: [4, 6, 8], example: 4 })
  @Expose()
  pinLength: number;

  @ApiProperty({ example: false })
  @Expose()
  requirePinRotation: boolean;

  @ApiProperty({ example: 30 })
  @Expose()
  pinRotationDays: number;

  @ApiProperty({ example: true })
  @Expose()
  allowPinRecovery: boolean;

  @ApiProperty({ example: 5 })
  @Expose()
  lockOnFailedAttempts: number;

  @ApiProperty({ example: 15 })
  @Expose()
  screenTimeoutMinutes: number;

  @ApiProperty({ example: true })
  @Expose()
  showClock: boolean;

  @ApiProperty({ example: false })
  @Expose()
  darkModeDefault: boolean;

  @ApiPropertyOptional({ example: 12, nullable: true })
  @Expose()
  autoClockOutHours: number | null;

  @ApiProperty({ example: false })
  @Expose()
  requireBreakLogging: boolean;

  @ApiProperty({ example: false })
  @Expose()
  allowShiftSwap: boolean;

  @ApiProperty({ example: 15 })
  @Expose()
  minBreakMinutes: number;

  @ApiProperty({ example: true })
  @Expose()
  newOrderSound: boolean;

  @ApiProperty({ example: true })
  @Expose()
  lowStockAlerts: boolean;

  @ApiProperty({ example: 70 })
  @Expose()
  notificationVolume: number;

  @ApiProperty({ example: false })
  @Expose()
  managerOverrideRequired: boolean;

  @ApiProperty({ example: true })
  @Expose()
  voidRequiresManager: boolean;

  @ApiProperty({ example: true })
  @Expose()
  refundRequiresManager: boolean;

  @ApiProperty({ example: true })
  @Expose()
  autoPrintKitchenTickets: boolean;

  @ApiProperty({ example: true })
  @Expose()
  autoPrintReceipt: boolean;

  @ApiProperty({ example: false })
  @Expose()
  autoPrintShiftSummary: boolean;

  @ApiProperty({ type: [String], example: ['orders:create'] })
  @Expose()
  defaultPermissions: string[];

  @ApiProperty({ example: false })
  @Expose()
  offlineModeEnabled: boolean;

  @ApiProperty({ example: 5 })
  @Expose()
  autoSyncMinutes: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  static from(entity: WorkstationSettingsEntity): WorkstationSettingsResponseDto {
    return plainToInstance(WorkstationSettingsResponseDto, entity, {
      excludeExtraneousValues: true,
    });
  }
}
