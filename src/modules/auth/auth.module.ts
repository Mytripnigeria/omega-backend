import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';
import { UserJwtStrategy } from './strategies/user-jwt.strategy';
import { AdminModule } from '../admin/admin.module';
import { StaffModule } from '../staff/staff.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CustomersModule } from '../customers/customers.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { UsersModule } from '../users/users.module';
import { PhoneOtpEntity } from './entities/phone-otp.entity';
import { WorkstationSettingsEntity } from '../workstation-settings/entities/workstation-settings.entity';
import { SmsService } from './sms/sms.service';
import { SMS_ADAPTER } from './sms/sms-adapter.interface';
import { ConsoleSmsAdapter } from './sms/console.adapter';
import { TermiiSmsAdapter } from './sms/termii.adapter';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([PhoneOtpEntity, WorkstationSettingsEntity]),
    AdminModule,
    StaffModule,
    ActivityLogModule,
    CustomersModule,
    UsersModule,
    ReferralsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SecurityService,
    AdminJwtStrategy,
    StaffJwtStrategy,
    UserJwtStrategy,
    ConsoleSmsAdapter,
    TermiiSmsAdapter,
    SmsService,
    {
      // Selects the SMS adapter at boot from the `SMS_PROVIDER` env var.
      // Defaults to the console adapter (dev-friendly, never sends real SMS)
      // when no explicit provider is configured.
      provide: SMS_ADAPTER,
      inject: [ConfigService, ConsoleSmsAdapter, TermiiSmsAdapter],
      useFactory: (
        config: ConfigService,
        consoleAdapter: ConsoleSmsAdapter,
        termiiAdapter: TermiiSmsAdapter,
      ) => {
        const provider = (config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
        return provider === 'termii' ? termiiAdapter : consoleAdapter;
      },
    },
  ],
  exports: [AuthService, SecurityService],
})
export class AuthModule {}
