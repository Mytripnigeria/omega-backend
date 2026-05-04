import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { AdminService } from '../admin/admin.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Disable2FADto, Verify2FADto } from './dto/two-factor.dto';

@Injectable()
export class SecurityService {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {
    authenticator.options = { window: 1 };
  }

  async changePassword(adminId: string, dto: ChangePasswordDto): Promise<void> {
    const admin = await this.adminService.findByIdWithSecrets(adminId);
    if (!admin) throw new ForbiddenException();
    const ok = await bcrypt.compare(dto.currentPassword, admin.password);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must differ from current');
    }
    const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);
    await this.adminService.updatePassword(adminId, newHash);
    // Invalidate refresh token so all existing sessions must re-authenticate.
    await this.adminService.updateRefreshToken(adminId, null);
  }

  async setup2FA(adminId: string): Promise<{ secret: string; otpauthUrl: string; qrCode: string }> {
    const admin = await this.adminService.findById(adminId);
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(admin.email, 'Mr. Jollof', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);
    // Persist secret but don't enable yet — user must verify a code first.
    await this.adminService.setTwoFactor(adminId, secret, false, null);
    return { secret, otpauthUrl, qrCode };
  }

  async enable2FA(adminId: string, dto: Verify2FADto): Promise<{ backupCodes: string[] }> {
    const admin = await this.adminService.findByIdWithSecrets(adminId);
    if (!admin?.twoFactorSecret) {
      throw new BadRequestException('Run /2fa/setup first');
    }
    const valid = authenticator.check(dto.code, admin.twoFactorSecret);
    if (!valid) throw new UnauthorizedException('Invalid code');
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 8).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 8).toUpperCase(),
    );
    await this.adminService.setTwoFactor(adminId, admin.twoFactorSecret, true, backupCodes);
    return { backupCodes };
  }

  async disable2FA(adminId: string, dto: Disable2FADto): Promise<void> {
    const admin = await this.adminService.findByIdWithSecrets(adminId);
    if (!admin) throw new ForbiddenException();
    const passwordOk = await bcrypt.compare(dto.password, admin.password);
    if (!passwordOk) throw new UnauthorizedException('Password is incorrect');
    if (!admin.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }
    const codeOk = authenticator.check(dto.code, admin.twoFactorSecret);
    if (!codeOk) throw new UnauthorizedException('Invalid code');
    await this.adminService.setTwoFactor(adminId, null, false, null);
  }

  /**
   * Verify a TOTP code against an admin's 2FA secret.
   * Used by the login flow when 2FA is enabled.
   */
  async verify2FACode(adminId: string, code: string): Promise<boolean> {
    const admin = await this.adminService.findByIdWithSecrets(adminId);
    if (!admin?.twoFactorSecret) return false;
    if (admin.twoFactorBackupCodes?.includes(code)) {
      // Consume the used backup code.
      const remaining = admin.twoFactorBackupCodes.filter((c) => c !== code);
      await this.adminService.setTwoFactor(
        adminId,
        admin.twoFactorSecret,
        admin.twoFactorEnabled,
        remaining,
      );
      return true;
    }
    return authenticator.check(code, admin.twoFactorSecret);
  }
}
