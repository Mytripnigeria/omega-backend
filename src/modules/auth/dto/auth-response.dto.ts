import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  businessId: string;

  @ApiProperty({ example: 'Emeka Obi' })
  fullName: string;

  @ApiProperty({ example: 'admin@mrjollof.com' })
  email: string;

  @ApiProperty({ example: 'owner' })
  role: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/emeka.png', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: false })
  twoFactorEnabled: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['orders.view', 'stocks.manage'],
    description:
      'Dashboard modules this login may use. `null` = unrestricted (owner).',
  })
  permissions: string[] | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description: 'Stores this login may work in. `null` = every store.',
  })
  storeIds: string[] | null;
}

export class AdminLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ type: () => AdminProfileDto })
  admin: AdminProfileDto;
}

export class AdminRefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;
}

export class StaffLookupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Amaka' })
  firstName: string;

  @ApiProperty({ example: 'Osei' })
  lastName: string;

  @ApiProperty({ example: 'Cashier' })
  roleName: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  avatar: string | null;
}

export class StaffSessionProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'STF001' })
  staffCode: string;

  @ApiProperty({ example: 'Amaka' })
  firstName: string;

  @ApiProperty({ example: 'Osei' })
  lastName: string;

  @ApiProperty({ format: 'uuid' })
  roleId: string;

  @ApiProperty({ example: 'Cashier' })
  roleName: string;

  @ApiProperty({ format: 'uuid' })
  businessId: string;

  @ApiProperty({ format: 'uuid' })
  storeId: string;

  @ApiProperty({ type: [String], example: ['view_products', 'create_orders'] })
  permissions: string[];
}

export class StaffLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: () => StaffSessionProfileDto })
  staff: StaffSessionProfileDto;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'TOTP secret to store in the authenticator app (also encoded in `otpauthUrl`)' })
  secret: string;

  @ApiProperty({ example: 'otpauth://totp/Mr.%20Jollof:admin@mrjollof.com?secret=JBSWY3DPEHPK3PXP&issuer=Mr.%20Jollof' })
  otpauthUrl: string;

  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgoAAAANS...', description: 'Base64 PNG QR code for the authenticator app to scan' })
  qrCode: string;
}

export class TwoFactorEnableResponseDto {
  @ApiProperty({
    type: [String],
    example: ['ABC123-DEF456', 'GHI789-JKL012'],
    description: 'One-time backup codes — store securely; each can only be used once if the authenticator app is lost.',
  })
  backupCodes: string[];
}
