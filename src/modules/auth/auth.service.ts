import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminService } from '../admin/admin.service';
import { StaffService } from '../staff/staff.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffLookupDto } from './dto/staff-lookup.dto';
import { StaffPinLoginDto } from './dto/staff-pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  AdminJwtPayload,
  StaffJwtPayload,
} from '../../common/types/jwt-payload.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminService: AdminService,
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async adminLogin(dto: AdminLoginDto) {
    const admin = await this.adminService.findByEmail(dto.email);
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, admin.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload: AdminJwtPayload = {
      sub: admin.id,
      sub_type: 'admin',
      email: admin.email,
      businessId: admin.businessId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get('jwt.expiresIn') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get('jwt.refreshExpiresIn') as any,
    });

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
    const hashedRefresh = await bcrypt.hash(refreshToken, saltRounds);
    await this.adminService.updateRefreshToken(admin.id, hashedRefresh);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        businessId: admin.businessId,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
        avatarUrl: admin.avatarUrl,
        twoFactorEnabled: admin.twoFactorEnabled,
      },
    };
  }

  async adminRefresh(dto: RefreshTokenDto) {
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret') as string,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const admin = await this.adminService.findByIdWithRefreshToken(payload.sub);
    if (!admin?.refreshToken) throw new UnauthorizedException('Session expired');

    const isValid = await bcrypt.compare(dto.refreshToken, admin.refreshToken);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const newPayload: AdminJwtPayload = {
      sub: admin.id,
      sub_type: 'admin',
      email: admin.email,
      businessId: admin.businessId,
    };

    const accessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('jwt.secret') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get('jwt.expiresIn') as any,
    });

    return { accessToken };
  }

  async adminLogout(adminId: string): Promise<void> {
    await this.adminService.updateRefreshToken(adminId, null);
  }

  async staffLookup(dto: StaffLookupDto) {
    const staff = await this.staffService.findByStaffCode(dto.staffCode);
    if (!staff || staff.status !== 'active') {
      throw new NotFoundException('Staff member not found');
    }
    return {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      roleName: staff.role?.name ?? '',
      avatar: staff.avatar,
    };
  }

  async staffPinLogin(dto: StaffPinLoginDto) {
    const staff = await this.staffService.findByStaffCodeWithPin(dto.staffCode);

    if (!staff || staff.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!staff.pin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.pin, staff.pin);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const permissions = staff.role?.permissions ?? [];

    const payload: StaffJwtPayload = {
      sub: staff.id,
      sub_type: 'staff',
      staffCode: staff.staffCode,
      storeId: staff.storeId,
      roleId: staff.roleId,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.staffSecret') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get('jwt.staffExpiresIn') as any,
    });

    return {
      accessToken,
      staff: {
        id: staff.id,
        staffCode: staff.staffCode,
        firstName: staff.firstName,
        lastName: staff.lastName,
        roleId: staff.roleId,
        roleName: staff.role?.name ?? '',
        storeId: staff.storeId,
        permissions,
      },
    };
  }
}
