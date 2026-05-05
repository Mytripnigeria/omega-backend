import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffLookupDto } from './dto/staff-lookup.dto';
import { StaffPinLoginDto } from './dto/staff-pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Disable2FADto, Verify2FADto } from './dto/two-factor.dto';
import {
  AdminLoginResponseDto,
  AdminRefreshResponseDto,
  StaffLookupResponseDto,
  StaffLoginResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorEnableResponseDto,
} from './dto/auth-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityService: SecurityService,
  ) {}

  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticates an admin with email and password. Returns a short-lived `accessToken` and a long-lived `refreshToken`. ' +
      'All responses are wrapped: `{ success, data, timestamp }`.',
  })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @ApiOperation({
    summary: 'Refresh admin access token',
    description: 'Issues a new `accessToken` using a valid `refreshToken`. No bearer header required.',
  })
  @ApiOkResponse({ type: AdminRefreshResponseDto })
  @Post('admin/refresh')
  adminRefresh(@Body() dto: RefreshTokenDto) {
    return this.authService.adminRefresh(dto);
  }

  @ApiOperation({
    summary: 'Admin logout',
    description: 'Revokes the stored refresh token for the authenticated admin. Requires admin bearer token.',
  })
  @ApiNoContentResponse({ description: 'Logged out successfully.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  adminLogout(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.authService.adminLogout(admin.sub);
  }

  @ApiOperation({
    summary: 'Change admin password',
    description: 'Changes the password for the authenticated admin. Requires current password verification.',
  })
  @ApiNoContentResponse({ description: 'Password changed successfully.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.securityService.changePassword(admin.sub, dto);
  }

  @ApiOperation({
    summary: 'Set up two-factor authentication',
    description:
      'Generates a TOTP secret and QR code for the authenticated admin to scan with an authenticator app. ' +
      'Call `POST /auth/admin/2fa/enable` with the TOTP code to activate.',
  })
  @ApiOkResponse({ type: TwoFactorSetupResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/setup')
  setup2FA(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.securityService.setup2FA(admin.sub);
  }

  @ApiOperation({
    summary: 'Enable two-factor authentication',
    description: 'Verifies the TOTP code from the authenticator app and activates 2FA on the account. Returns one-time backup codes.',
  })
  @ApiOkResponse({ type: TwoFactorEnableResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/enable')
  enable2FA(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: Verify2FADto) {
    return this.securityService.enable2FA(admin.sub, dto);
  }

  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description: 'Disables 2FA for the authenticated admin. Requires current password and a valid TOTP code.',
  })
  @ApiNoContentResponse({ description: '2FA disabled.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  disable2FA(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: Disable2FADto) {
    return this.securityService.disable2FA(admin.sub, dto);
  }

  @ApiOperation({
    summary: 'Staff code lookup',
    description:
      'Given a staff code, returns the staff member\'s name and avatar for display on the workstation PIN entry screen. ' +
      'No authentication required.',
  })
  @ApiOkResponse({ type: StaffLookupResponseDto })
  @Post('staff/lookup')
  staffLookup(@Body() dto: StaffLookupDto) {
    return this.authService.staffLookup(dto);
  }

  @ApiOperation({
    summary: 'Staff PIN login',
    description:
      'Authenticates a staff member with their staff code and 4-digit PIN. Returns a staff `accessToken` ' +
      'valid for workstation operations. No bearer header required.',
  })
  @ApiOkResponse({ type: StaffLoginResponseDto })
  @Post('staff/login')
  staffPinLogin(@Body() dto: StaffPinLoginDto) {
    return this.authService.staffPinLogin(dto);
  }
}
