import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  type?: 'refresh'; // отсутствует у access-токенов, см. AuthService.issueTokens
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-insecure-secret-change-me'),
    });
  }

  validate(payload: JwtPayload) {
    // Refresh-токены имеют собственный, более длинный TTL (7д против 15м у
    // access) — без этой проверки они бы проходили как полноценные
    // access-токены везде, где ожидается Bearer-заголовок.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh-токен нельзя использовать как access-токен');
    }
    return { userId: payload.sub };
  }
}
