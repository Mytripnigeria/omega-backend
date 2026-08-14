import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { DASHBOARD_PERMISSIONS } from '../../../common/permissions/dashboard-permissions';

/**
 * Grants a staff member a login for the merchant dashboard (the hub), separate
 * from their workstation PIN.
 */
export class GrantDashboardAccessDto {
  @ApiPropertyOptional({
    description:
      "Login email. Defaults to the staff member's own email when they have one.",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: ['admin', 'support'],
    default: 'admin',
    description:
      'Dashboard role. `owner` is reserved for the business owner and cannot ' +
      'be granted here.',
  })
  @IsOptional()
  @IsIn(['admin', 'support'])
  role?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Stores this login may work in. Omit to allow every store in the ' +
      "business; normally set to the staff member's own store.",
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  storeIds?: string[];

  /**
   * Dashboard modules this login may use, e.g. `["orders.view",
   * "stocks.manage"]`. `manage` implies `view`. Omit to default to read-only
   * access to the operational modules — never the whole business.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['orders.view', 'stocks.manage'],
    description:
      'Module permissions. Values must come from GET /staff/dashboard-permissions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(DASHBOARD_PERMISSIONS, { each: true })
  permissions?: string[];
}

/**
 * The generated password, returned **once** at grant/reset time and never
 * retrievable again — it is stored only as a bcrypt hash.
 */
export class DashboardAccessCredentialsDto {
  @ApiProperty({ format: 'uuid' })
  adminId: string;

  @ApiProperty({ example: 'amaka@mrjollof.com' })
  email: string;

  @ApiProperty({
    example: 'Kf7-2mQr-9xTz',
    description:
      'Temporary password. Shown once — copy it now and hand it to the staff ' +
      'member; they must change it on first login.',
  })
  temporaryPassword: string;

  @ApiProperty({ example: 'admin' })
  role: string;

  @ApiPropertyOptional({ type: [String], nullable: true })
  storeIds: string[] | null;

  @ApiProperty({ type: [String], example: ['orders.view'] })
  permissions: string[];
}
