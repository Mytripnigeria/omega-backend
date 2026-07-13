import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AdminEntity } from '../admin/entities/admin.entity';
import { BusinessEntity } from '../business/entities/business.entity';
import { StoreEntity } from '../store/entities/store.entity';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminService } from '../admin/admin.service';
import { StaffService } from '../staff/staff.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CustomersService } from '../customers/customers.service';
import { ReferralsService } from '../referrals/referrals.service';
import { UsersService } from '../users/users.service';
import { CustomerSource } from '../customers/entities/customer.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StaffLookupDto } from './dto/staff-lookup.dto';
import { StaffPinLoginDto } from './dto/staff-pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  StorefrontLoginDto,
  StorefrontRegisterDto,
} from './dto/storefront-register.dto';
import { StorefrontGoogleAuthDto } from './dto/google-auth.dto';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import { assertWithinGeofence } from '../../common/utils/geofence';
import {
  RequestPhoneOtpDto,
  VerifyPhoneOtpDto,
} from './dto/phone-auth.dto';
import { PhoneOtpEntity } from './entities/phone-otp.entity';
import { SmsService } from './sms/sms.service';
import {
  AdminJwtPayload,
  StaffJwtPayload,
  UserJwtPayload,
} from '../../common/types/jwt-payload.types';
import { ConflictException } from '@nestjs/common';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_HOURLY_LIMIT = 5;

/**
 * Normalises an end-user-typed phone number to E.164. Accepts already-E.164
 * inputs, NG-local `0XXX...`, and bare digit strings (treated as NG by default).
 * Returns `null` if the input can't reasonably be interpreted as a phone.
 */
function normalisePhoneE164(raw: string, defaultRegion = 'NG'): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/[\s\-()]/g, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (defaultRegion === 'NG') {
    if (digits.startsWith('234')) return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
    if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
    if (digits.length === 10) return `+234${digits}`;
  }
  // Fallback: treat as already-international digits.
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly adminService: AdminService,
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly activityLog: ActivityLogService,
    private readonly customersService: CustomersService,
    private readonly usersService: UsersService,
    private readonly referralsService: ReferralsService,
    @InjectRepository(PhoneOtpEntity)
    private readonly phoneOtpRepo: Repository<PhoneOtpEntity>,
    @InjectRepository(WorkstationSettingsEntity)
    private readonly workstationSettingsRepo: Repository<WorkstationSettingsEntity>,
    @Inject(SmsService)
    private readonly smsService: SmsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Self-signup for a new merchant. Creates the Business, Admin (password is
   * hashed by AdminEntity's @BeforeInsert hook on save), and the first Store
   * in one transaction, then issues admin tokens — the returned shape matches
   * {@link adminLogin} so the merchant-hub can auto-login the new admin.
   */
  async adminRegister(dto: AdminRegisterDto) {
    const existing = await this.adminService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const savedAdmin = await this.dataSource.transaction(async (manager) => {
      const businessRepo = manager.getRepository(BusinessEntity);
      const business = businessRepo.create({
        name: dto.businessName,
        currency: dto.currency ?? 'NGN',
      });
      const savedBusiness = await businessRepo.save(business);

      const adminRepo = manager.getRepository(AdminEntity);
      const admin = adminRepo.create({
        businessId: savedBusiness.id,
        fullName: dto.fullName,
        email: dto.email,
        password: dto.password, // hashed by AdminEntity @BeforeInsert
        phone: dto.phone,
        role: 'owner',
        isActive: true,
      });
      const adminRow = await adminRepo.save(admin);

      const storeRepo = manager.getRepository(StoreEntity);
      const store = storeRepo.create({
        businessId: savedBusiness.id,
        name: dto.storeName,
        address: dto.storeAddress,
        phone: dto.storePhone || dto.phone || '',
        email: dto.storeEmail || dto.email,
        city: dto.storeCity ?? undefined,
        state: dto.storeState ?? undefined,
      });
      await storeRepo.save(store);

      return adminRow;
    });

    const payload: AdminJwtPayload = {
      sub: savedAdmin.id,
      sub_type: 'admin',
      email: savedAdmin.email,
      businessId: savedAdmin.businessId,
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
    await this.adminService.updateRefreshToken(savedAdmin.id, hashedRefresh);

    this.activityLog.record({
      actorType: 'admin',
      actorId: savedAdmin.id,
      actorName: savedAdmin.fullName,
      action: 'admin.registered',
      businessId: savedAdmin.businessId,
      resourceType: 'admin',
      resourceId: savedAdmin.id,
    });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: savedAdmin.id,
        businessId: savedAdmin.businessId,
        fullName: savedAdmin.fullName,
        email: savedAdmin.email,
        role: savedAdmin.role,
        avatarUrl: savedAdmin.avatarUrl,
        twoFactorEnabled: savedAdmin.twoFactorEnabled,
      },
    };
  }

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

    this.activityLog.record({
      actorType: 'admin',
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'admin.logged_in',
      businessId: admin.businessId,
      resourceType: 'admin',
      resourceId: admin.id,
    });

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

  async adminMe(adminId: string) {
    const admin = await this.adminService.findById(adminId);
    return {
      id: admin.id,
      businessId: admin.businessId,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      twoFactorEnabled: admin.twoFactorEnabled,
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
    const admin = await this.adminService.findById(adminId).catch(() => null);
    if (admin) {
      this.activityLog.record({
        actorType: 'admin',
        actorId: admin.id,
        actorName: admin.fullName,
        action: 'admin.logged_out',
        businessId: admin.businessId,
        resourceType: 'admin',
        resourceId: admin.id,
      });
    }
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
    const businessId = staff.store?.businessId;
    if (!businessId) {
      throw new UnauthorizedException('Staff is not assigned to a store');
    }

    // Geofencing: when the merchant restricts login to the work environment,
    // require the device's coordinates to fall inside the configured radius.
    const wsSettings = await this.workstationSettingsRepo.findOne({
      where: { businessId },
    });
    assertWithinGeofence(
      wsSettings,
      { latitude: dto.latitude, longitude: dto.longitude },
      'log in',
    );

    const payload: StaffJwtPayload = {
      sub: staff.id,
      sub_type: 'staff',
      staffCode: staff.staffCode,
      businessId,
      storeId: staff.storeId,
      roleId: staff.roleId,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.staffSecret') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get('jwt.staffExpiresIn') as any,
    });

    this.activityLog.record({
      actorType: 'staff',
      actorId: staff.id,
      actorName: `${staff.firstName} ${staff.lastName}`,
      action: 'staff.logged_in',
      businessId,
      storeId: staff.storeId,
      resourceType: 'staff',
      resourceId: staff.id,
      metadata: { staffCode: staff.staffCode, roleName: staff.role?.name ?? null },
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
        businessId,
        storeId: staff.storeId,
        permissions,
      },
    };
  }

  // ========== Storefront (User) flows ==========

  async storefrontRegister(dto: StorefrontRegisterDto) {
    const existingUser = await this.usersService.findByEmail(
      dto.businessId,
      dto.email,
    );
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Find or create the customer record. If a customer with this email or phone
    // already exists in the business (e.g. created by an admin), reuse it.
    let customer = await this.customersService.findByEmailOrPhone(
      dto.businessId,
      dto.email,
      dto.phone,
    );
    if (!customer) {
      customer = await this.customersService.createInternal(dto.businessId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        source: CustomerSource.STOREFRONT,
      });
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
    const hashed = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.usersService.create({
      businessId: dto.businessId,
      customerId: customer.id,
      email: dto.email,
      password: hashed,
    });

    // Optional: link this signup to the referrer's account.
    if (dto.referredByCode) {
      try {
        await this.referralsService.recordSignUp(
          dto.businessId,
          customer.id,
          dto.referredByCode,
        );
      } catch {
        // Don't block registration on referral lookup failures.
      }
    }

    return this.issueUserTokens(user.id, user.email, user.businessId, user.customerId);
  }

  async storefrontLogin(dto: StorefrontLoginDto) {
    const user = await this.usersService.findByEmail(dto.businessId, dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    await this.usersService.recordLogin(user.id);

    return this.issueUserTokens(user.id, user.email, user.businessId, user.customerId);
  }

  /**
   * Sign in (or sign up) a storefront customer with a Google ID token. The
   * token is verified against GOOGLE_CLIENT_ID, then we find-or-create the
   * customer + surrogate user by the verified Google email.
   */
  async storefrontGoogle(dto: StorefrontGoogleAuthDto) {
    const clientId =
      this.configService.get<string>('google.clientId') ??
      process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google login is not configured');
    }
    if (!this.googleClient) this.googleClient = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account has no verified email');
    }

    const email = payload.email.toLowerCase();
    const firstName = payload.given_name ?? payload.name ?? 'Customer';
    const lastName = payload.family_name ?? '';

    let customer = await this.customersService.findByEmailOrPhone(
      dto.businessId,
      email,
      undefined,
    );
    if (!customer) {
      customer = await this.customersService.createInternal(dto.businessId, {
        firstName,
        lastName,
        email,
        source: CustomerSource.STOREFRONT,
      });
      if (dto.referredByCode) {
        try {
          await this.referralsService.recordSignUp(
            dto.businessId,
            customer.id,
            dto.referredByCode,
          );
        } catch {
          // Bad referral code shouldn't block sign-up.
        }
      }
    }

    let user = await this.usersService.findByCustomerId(customer.id);
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
      user = await this.usersService.create({
        businessId: dto.businessId,
        customerId: customer.id,
        email,
        password: await bcrypt.hash(randomPassword, saltRounds),
      });
    }

    await this.usersService.recordLogin(user.id);
    return this.issueUserTokens(user.id, user.email, user.businessId, user.customerId);
  }

  async storefrontRefresh(dto: RefreshTokenDto) {
    let payload: UserJwtPayload;
    try {
      payload = this.jwtService.verify<UserJwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret') as string,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Session expired');
    }

    const ok = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Invalid refresh token');

    // Refresh-token rotation: mint a fresh access + refresh pair, persist the
    // new hashed refresh token, and invalidate the old one so it can't be
    // reused. The client stores both new tokens.
    return this.issueUserTokens(
      user.id,
      user.email,
      user.businessId,
      user.customerId,
    );
  }

  async storefrontLogout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async issueUserTokens(
    userId: string,
    email: string,
    businessId: string,
    customerId: string,
  ) {
    const payload: UserJwtPayload = {
      sub: userId,
      sub_type: 'user',
      email,
      businessId,
      customerId,
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
    const hashed = await bcrypt.hash(refreshToken, saltRounds);
    await this.usersService.updateRefreshToken(userId, hashed);

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        businessId,
        customerId,
      },
    };
  }

  // ─── Phone OTP ─────────────────────────────────────────────────────────

  /**
   * Generates and sends a one-time code to the supplied phone. Rate-limited
   * per phone to prevent abuse:
   *  • at most 1 request every {@link OTP_RESEND_COOLDOWN_SECONDS}
   *  • at most {@link OTP_HOURLY_LIMIT} requests per rolling hour
   *
   * The caller always gets a uniform success response — we don't leak whether
   * a customer record exists for the number to avoid phone enumeration.
   */
  async requestPhoneOtp(dto: RequestPhoneOtpDto): Promise<{ ok: true; phone: string }> {
    const phone = normalisePhoneE164(dto.phone);
    if (!phone) throw new BadRequestException('Invalid phone number');

    const now = new Date();
    const cooldownStart = new Date(now.getTime() - OTP_RESEND_COOLDOWN_SECONDS * 1000);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recent, hourlyCount] = await Promise.all([
      this.phoneOtpRepo.findOne({
        where: { phone, businessId: dto.businessId, consumed: false },
        order: { createdAt: 'DESC' },
      }),
      this.phoneOtpRepo
        .createQueryBuilder('o')
        .where('o.phone = :p AND o.businessId = :b', { p: phone, b: dto.businessId })
        .andWhere('o.createdAt >= :since', { since: hourAgo })
        .getCount(),
    ]);

    if (recent && recent.createdAt > cooldownStart) {
      throw new BadRequestException(
        'Please wait a moment before requesting another code.',
      );
    }
    if (hourlyCount >= OTP_HOURLY_LIMIT) {
      throw new BadRequestException(
        'Too many code requests. Try again later.',
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const otp = this.phoneOtpRepo.create({
      phone,
      businessId: dto.businessId,
      codeHash: sha256(code),
      purpose: dto.purpose ?? 'login',
      expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
      attempts: 0,
      consumed: false,
    });
    await this.phoneOtpRepo.save(otp);

    const delivered = await this.smsService.send(
      phone,
      `Your verification code is ${code}. It expires in 5 minutes.`,
    );
    if (!delivered) {
      // Don't expose delivery failure to the caller — log for ops. The next
      // request_otp call (after cooldown) will retry naturally.
      this.logger.warn(`OTP delivery failed for ${phone} (otp row ${otp.id})`);
    }
    return { ok: true, phone };
  }

  /**
   * Verifies a previously-sent code and issues storefront tokens. Side
   * effects: find-or-create the customer record (so phone-only signups work
   * end-to-end), find-or-create a synthetic UserEntity bound to the customer
   * for refresh-token tracking, and record a successful login.
   */
  async verifyPhoneOtp(dto: VerifyPhoneOtpDto) {
    const phone = normalisePhoneE164(dto.phone);
    if (!phone) throw new BadRequestException('Invalid phone number');

    const now = new Date();
    const otp = await this.phoneOtpRepo.findOne({
      where: { phone, businessId: dto.businessId, consumed: false },
      order: { createdAt: 'DESC' },
    });
    if (!otp) {
      throw new UnauthorizedException('No active code for this number');
    }
    if (otp.expiresAt < now) {
      throw new UnauthorizedException('Code has expired — request a new one');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts — request a new code');
    }

    otp.attempts += 1;
    if (otp.codeHash !== sha256(dto.code)) {
      await this.phoneOtpRepo.save(otp);
      throw new UnauthorizedException('Invalid code');
    }
    otp.consumed = true;
    await this.phoneOtpRepo.save(otp);

    // Find or create the customer.
    let customer = await this.customersService.findByEmailOrPhone(
      dto.businessId,
      undefined,
      phone,
    );
    if (!customer) {
      if (!dto.firstName || !dto.lastName) {
        throw new BadRequestException(
          "First and last name are required for first-time phone sign-up.",
        );
      }
      customer = await this.customersService.createInternal(dto.businessId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone,
        source: CustomerSource.STOREFRONT,
      });
      if (dto.referredByCode) {
        try {
          await this.referralsService.recordSignUp(
            dto.businessId,
            customer.id,
            dto.referredByCode,
          );
        } catch {
          // Bad referral code shouldn't block sign-up.
        }
      }
    }

    // Find or create the surrogate UserEntity. We use a synthetic email so the
    // existing email-keyed user store can host phone-only accounts without a
    // schema change. The synthetic email is never shown to end users; if they
    // later add a real email through the storefront-register flow, that row
    // will be created separately and the customer can be linked by phone.
    let user = await this.usersService.findByCustomerId(customer.id);
    if (!user) {
      const syntheticEmail = `phone+${phone.slice(1)}@phone.users.local`;
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
      user = await this.usersService.create({
        businessId: dto.businessId,
        customerId: customer.id,
        email: syntheticEmail,
        password: await bcrypt.hash(randomPassword, saltRounds),
      });
    }

    await this.usersService.recordLogin(user.id);
    return this.issueUserTokens(user.id, user.email, user.businessId, user.customerId);
  }
}
