import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: number;
  email: string;
}

/** Validates bearer JWTs and supplies the authenticated user identity to guards. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** Rejects malformed token subjects before they can enter application services. */
  validate(payload: JwtPayload) {
    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
      throw new UnauthorizedException('Unauthorized');
    }

    return { userId: payload.sub, email: payload.email };
  }
}
