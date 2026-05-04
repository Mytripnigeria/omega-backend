import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityService } from './security.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';
import { AdminModule } from '../admin/admin.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    AdminModule,
    StaffModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SecurityService, AdminJwtStrategy, StaffJwtStrategy],
  exports: [AuthService, SecurityService],
})
export class AuthModule {}
