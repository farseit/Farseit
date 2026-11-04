import { BadRequestException, Injectable, Logger, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { normalizePhone } from '../common/utils';
import { PrismaService } from '../prisma/prisma.module';
import { SmsService } from '../sms/sms.module';
import { CurrentUser, JwtAuthGuard } from './guards';

const RESET_TTL_MIN = 10; // code koto minute valid
const RESET_MAX_REQUESTS = 3; // ek phone-e 15 minute-e max koyta code
const RESET_MAX_WRONG = 5; // ekta code-e max koyta vul try

@Injectable()
export class AuthService {
  private log = new Logger('Auth');

  // Simple in-memory brute-force protection: 5 failed attempts / 15 minutes per identifier
  private attempts = new Map<string, { count: number; until: number }>();

  // Pura server-e SMS cost attack thekate: 10 minute-e max 40 ta reset request
  private resetHits: number[] = [];

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private sms: SmsService,
    private config: ConfigService,
  ) {}

  private sign(user: any) {
    const { password, ...safe } = user;
    return { accessToken: this.jwt.sign({ sub: user.id, role: user.role }), user: safe };
  }

  async register(input: any) {
    const name = (input.name || '').trim();
    if (name.length < 2) throw new BadRequestException('Name is too short');
    if ((input.password || '').length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const phone = normalizePhone(input.phone);
    const email = input.email ? String(input.email).trim().toLowerCase() : null;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Invalid email address');

    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
    });
    if (exists) throw new BadRequestException('An account with this phone or email already exists');

    const user = await this.prisma.user.create({
      data: { name, phone, email, password: await bcrypt.hash(input.password, 10) },
    });
    return this.sign(user);
  }

  async login(identifier: string, password: string) {
    const key = (identifier || '').trim().toLowerCase();
    const entry = this.attempts.get(key);
    if (entry && entry.count >= 5 && entry.until > Date.now()) {
      throw new UnauthorizedException('Too many attempts. Please try again in a few minutes.');
    }

    let user = null;
    if (key.includes('@')) {
      user = await this.prisma.user.findUnique({ where: { email: key } });
    } else {
      try {
        user = await this.prisma.user.findUnique({ where: { phone: normalizePhone(key) } });
      } catch {
        user = null;
      }
    }

    if (!user || !user.isActive || !(await bcrypt.compare(password || '', user.password))) {
      const count = (entry && entry.until > Date.now() ? entry.count : 0) + 1;
      this.attempts.set(key, { count, until: Date.now() + 15 * 60 * 1000 });
      throw new UnauthorizedException('Invalid phone/email or password');
    }
    this.attempts.delete(key);
    return this.sign(user);
  }

  // ---------- Profile ----------

  /** avatar = shudhu amader nijer upload kora (ba Cloudinary-r) link. Khali/null dile soriye dey */
  async updateAvatar(userId: string, avatar?: string | null) {
    const url = avatar ? String(avatar).trim() : '';
    if (url) {
      const base = (this.config.get<string>('PUBLIC_API_URL') || 'http://localhost:4000').replace(/\/$/, '');
      const ok = url.length <= 500 && (url.startsWith(`${base}/uploads/`) || url.startsWith('https://res.cloudinary.com/'));
      if (!ok) throw new BadRequestException('Invalid image link');
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatar: url || null } });
    const { password, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, input: { name: string; email?: string | null }) {
    const name = (input.name || '').trim();
    if (name.length < 2) throw new BadRequestException('Name is too short');
    const email = input.email ? String(input.email).trim().toLowerCase() : null;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Invalid email address');
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
      if (taken) throw new BadRequestException('This email is already used by another account');
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name, email } });
    const { password, ...safe } = user;
    return safe;
  }

  async changePassword(userId: string, current: string, next: string) {
    const key = `pw:${userId}`;
    const entry = this.attempts.get(key);
    if (entry && entry.count >= 5 && entry.until > Date.now()) {
      throw new BadRequestException('Too many attempts. Please try again in a few minutes.');
    }
    if ((next || '').length < 6) throw new BadRequestException('Password must be at least 6 characters');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current || '', user.password))) {
      const count = (entry && entry.until > Date.now() ? entry.count : 0) + 1;
      this.attempts.set(key, { count, until: Date.now() + 15 * 60 * 1000 });
      throw new BadRequestException('Current password is incorrect');
    }
    if (current === next) throw new BadRequestException('New password must be different from the current one');

    this.attempts.delete(key);
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(next, 10) } });
    return true;
  }

  // ---------- Forgot password (SMS code) ----------

  /** Code database-e plain rakhi na, secret diye hash kore rakhi */
  private hashCode(userId: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${userId}:${code}`).digest('hex');
  }

  /**
   * Phone-e 6 digit code pathay. Account ache kina seta kokhono bole na
   * (na thakleo, rate limit hole-o "true" ferot dey), jate keu jante na pare kon number registered.
   */
  async requestPasswordReset(rawPhone: string) {
    const phone = normalizePhone(rawPhone);

    const now = Date.now();
    this.resetHits = this.resetHits.filter((t) => now - t < 10 * 60 * 1000);
    if (this.resetHits.length >= 40) throw new BadRequestException('Too many requests. Please try again later.');
    this.resetHits.push(now);

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return true;

    const recent = await this.prisma.passwordReset.count({
      where: { userId: user.id, createdAt: { gt: new Date(now - 15 * 60 * 1000) } },
    });
    if (recent >= RESET_MAX_REQUESTS) {
      this.log.warn(`Password reset rate limit: ${phone}`);
      return true;
    }

    const code = String(randomInt(100000, 1000000));
    // ager unused code gulo batil
    await this.prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const row = await this.prisma.passwordReset.create({
      data: { userId: user.id, codeHash: this.hashCode(user.id, code), expiresAt: new Date(now + RESET_TTL_MIN * 60 * 1000) },
    });

    const store = this.config.get<string>('SMS_STORE_NAME') || 'Farse AI';
    const sent = await this.sms.send(
      phone,
      `${store}: Apnar password reset code ${code}. ${RESET_TTL_MIN} minute-er moddhe use korun. Eta kauke bolben na.`,
    );
    if (!sent.ok) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        // local test-er jonno: SMS off/fail hole code terminal-e dekhabe
        this.log.warn(`[DEV] SMS pathano jay ni (${sent.error}). ${phone}-er reset code: ${code}`);
      } else {
        this.log.error(`Password reset SMS failed for ${phone}: ${sent.error}`);
        await this.prisma.passwordReset.delete({ where: { id: row.id } }).catch(() => undefined);
        throw new BadRequestException('Could not send SMS right now. Please try again later.');
      }
    }
    return true;
  }

  async resetPassword(rawPhone: string, code: string, newPassword: string) {
    const phone = normalizePhone(rawPhone);
    if ((newPassword || '').length < 6) throw new BadRequestException('Password must be at least 6 characters');

    const bad = new BadRequestException('Invalid or expired code');
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw bad;

    const row = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw bad;

    if (row.attempts >= RESET_MAX_WRONG) {
      await this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      throw new BadRequestException('Too many wrong attempts. Please request a new code.');
    }

    const given = Buffer.from(this.hashCode(user.id, String(code || '').trim()));
    const real = Buffer.from(row.codeHash);
    if (given.length !== real.length || !timingSafeEqual(given, real)) {
      await this.prisma.passwordReset.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw bad;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { password: hash } }),
      this.prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);

    // ei phone-er login lockout (5 vul password) thakle sheta khule dai
    for (const k of [...this.attempts.keys()]) {
      try {
        if (!k.includes('@') && normalizePhone(k) === phone) this.attempts.delete(k);
      } catch {
        /* valid phone na */
      }
    }
    return true;
  }
}

@Resolver()
export class AuthResolver {
  constructor(private auth: AuthService) {}

  @Mutation('register')
  register(@Args('input') input: any) {
    return this.auth.register(input);
  }

  @Mutation('login')
  login(@Args('identifier') identifier: string, @Args('password') password: string) {
    return this.auth.login(identifier, password);
  }

  @Mutation('requestPasswordReset')
  requestPasswordReset(@Args('phone') phone: string) {
    return this.auth.requestPasswordReset(phone);
  }

  @Mutation('resetPassword')
  resetPassword(@Args('phone') phone: string, @Args('code') code: string, @Args('newPassword') newPassword: string) {
    return this.auth.resetPassword(phone, code, newPassword);
  }

  @Mutation('updateAvatar')
  @UseGuards(JwtAuthGuard)
  updateAvatar(@CurrentUser() user: any, @Args('avatar') avatar?: string) {
    return this.auth.updateAvatar(user.id, avatar);
  }

  @Mutation('updateProfile')  @Mutation('updateProfile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: any, @Args('name') name: string, @Args('email') email?: string) {
    return this.auth.updateProfile(user.id, { name, email });
  }

  @Mutation('changePassword')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: any, @Args('currentPassword') currentPassword: string, @Args('newPassword') newPassword: string) {
    return this.auth.changePassword(user.id, currentPassword, newPassword);
  }

  @Query('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    const { password, ...safe } = user;
    return safe;
  }
}