import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StaffJwtPayload } from '../../../common/types/jwt-payload.types';

@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'staff-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.staffSecret') as string,
    });
  }

  validate(payload: StaffJwtPayload): StaffJwtPayload {
    if (payload.sub_type !== 'staff') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
