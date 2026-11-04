import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.module';

const TTL = 30_000; // 30 second
const cache = new Map<string, { user: any; exp: number }>();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }) {
    const hit = cache.get(payload.sub);
    if (hit && hit.exp > Date.now()) return hit.user;

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      cache.delete(payload.sub);
      throw new UnauthorizedException();
    }
    if (cache.size > 2000) cache.clear(); // memory barbe na
    cache.set(payload.sub, { user, exp: Date.now() + TTL });
    return user;
  }
}