import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateWorkstationSettingsDto {
  @ApiPropertyOptional({ enum: [4, 6, 8], example: 4 })
  @IsOptional()
  @IsInt()
  @IsIn([4, 6, 8])
  pinLength?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requirePinRotation?: boolean;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  pinRotationDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowPinRecovery?: boolean;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  lockOnFailedAttempts?: number;

  @ApiPropertyOptional({ example: 15, minimum: 1, maximum: 240 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  screenTimeoutMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showClock?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  darkModeDefault?: boolean;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    minimum: 1,
    maximum: 24,
    description: 'Auto-clock-out hours. Send null to disable.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  autoClockOutHours?: number | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireBreakLogging?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowShiftSwap?: boolean;

  @ApiPropertyOptional({ example: 15, minimum: 1, maximum: 240 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  minBreakMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  newOrderSound?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  lowStockAlerts?: boolean;

  @ApiPropertyOptional({ example: 70, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  notificationVolume?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoAcceptOrders?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  managerOverrideRequired?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  voidRequiresManager?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  refundRequiresManager?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoPrintKitchenTickets?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoPrintReceipt?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoPrintShiftSummary?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['orders:create', 'orders:edit'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  defaultPermissions?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { counter_pos: ['Cashier'], instore: ['Manager'] },
    description: 'Per-function role access map (function key → allowed role names).',
  })
  @IsOptional()
  @IsObject()
  functionRoleAccess?: Record<string, string[]>;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  offlineModeEnabled?: boolean;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  autoSyncMinutes?: number;

  @ApiPropertyOptional({ example: false, description: 'Restrict staff login/clock-in to the geofence.' })
  @IsOptional()
  @IsBoolean()
  geofenceEnabled?: boolean;

  @ApiPropertyOptional({ example: 6.5244, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  geofenceLatitude?: number;

  @ApiPropertyOptional({ example: 3.3792, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  geofenceLongitude?: number;

  @ApiPropertyOptional({ example: 100, minimum: 10, maximum: 100000, description: 'Geofence radius in metres.' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  geofenceRadiusMeters?: number;
}
