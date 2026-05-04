import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffLookupDto } from './dto/staff-lookup.dto';
import { StaffPinLoginDto } from './dto/staff-pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Disable2FADto, Verify2FADto } from './dto/two-factor.dto';
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

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('admin/refresh')
  adminRefresh(@Body() dto: RefreshTokenDto) {
    return this.authService.adminRefresh(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/logout')
  adminLogout(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.authService.adminLogout(admin.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/change-password')
  changePassword(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.securityService.changePassword(admin.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/setup')
  setup2FA(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.securityService.setup2FA(admin.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/enable')
  enable2FA(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: Verify2FADto) {
    return this.securityService.enable2FA(admin.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/2fa/disable')
  disable2FA(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: Disable2FADto) {
    return this.securityService.disable2FA(admin.sub, dto);
  }

  @Post('staff/lookup')
  staffLookup(@Body() dto: StaffLookupDto) {
    return this.authService.staffLookup(dto);
  }

  @Post('staff/login')
  staffPinLogin(@Body() dto: StaffPinLoginDto) {
    return this.authService.staffPinLogin(dto);
  }
}
