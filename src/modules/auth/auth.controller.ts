import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffLookupDto } from './dto/staff-lookup.dto';
import { StaffPinLoginDto } from './dto/staff-pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Disable2FADto, Verify2FADto } from './dto/two-factor.dto';
import { RequestPhoneOtpDto, VerifyPhoneOtpDto } from './dto/phone-auth.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import {
  StorefrontLoginDto,
  StorefrontRegisterDto,
} from './dto/storefront-register.dto';
import { StorefrontGoogleAuthDto } from './dto/google-auth.dto';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { Request } from 'express';
import { Req } from '@nestjs/common';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import {
  AdminLoginResponseDto,
  AdminProfileDto,
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
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @ApiOperation({
    summary: 'Self-signup for a new merchant',
    description:
      'Creates the business, admin account, and first store in one transaction, then returns admin tokens. ' +
      'Used by the merchant-hub onboarding wizard so a new merchant goes from "Sign up" to a working dashboard in one step. Rate-limited.',
  })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('admin/register')
  adminRegister(@Body() dto: AdminRegisterDto) {
    return this.authService.adminRegister(dto);
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
    summary: 'Current admin profile',
    description: 'Returns the admin record matching the bearer token.',
  })
  @ApiOkResponse({ type: AdminProfileDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/me')
  adminMe(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.authService.adminMe(admin.sub);
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

  // ========== Storefront (User) ==========

  @ApiOperation({
    summary: 'Storefront register',
    description:
      'Creates a storefront user account. If a customer with the same email or phone already exists ' +
      'in the business, the new user is linked to that existing customer; otherwise a new customer record is created.',
  })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('storefront/register')
  storefrontRegister(@Body() dto: StorefrontRegisterDto) {
    return this.authService.storefrontRegister(dto);
  }

  @ApiOperation({ summary: 'Storefront login' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('storefront/login')
  storefrontLogin(@Body() dto: StorefrontLoginDto) {
    return this.authService.storefrontLogin(dto);
  }

  @ApiOperation({
    summary: 'Storefront Google login/signup',
    description:
      'Verifies a Google ID token and issues storefront tokens. Creates a customer + surrogate ' +
      'user on first sign-in. Used for "Continue with Google" on login and sign-up.',
  })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('storefront/google')
  storefrontGoogle(@Body() dto: StorefrontGoogleAuthDto) {
    return this.authService.storefrontGoogle(dto);
  }

  @ApiOperation({ summary: 'Storefront refresh token' })
  @Post('storefront/refresh')
  storefrontRefresh(@Body() dto: RefreshTokenDto) {
    return this.authService.storefrontRefresh(dto);
  }

  @ApiOperation({
    summary: 'Request a phone OTP',
    description:
      'Generates a 6-digit code and sends it to the supplied phone via SMS. Rate-limited per phone (1/30s, 5/hour).',
  })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('storefront/phone/request-otp')
  requestPhoneOtp(@Body() dto: RequestPhoneOtpDto) {
    return this.authService.requestPhoneOtp(dto);
  }

  @ApiOperation({
    summary: 'Verify a phone OTP',
    description:
      'Verifies the code and issues storefront tokens. Creates a customer record (and surrogate user) on first sign-in — `firstName`+`lastName` are required for new customers.',
  })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('storefront/phone/verify')
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto) {
    return this.authService.verifyPhoneOtp(dto);
  }

  @ApiOperation({ summary: 'Storefront logout' })
  @ApiBearerAuth()
  @UseGuards(UserJwtGuard)
  @Post('storefront/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  storefrontLogout(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.authService.storefrontLogout(user.sub);
  }
}
