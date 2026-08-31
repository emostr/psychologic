import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashSecret, verifySecret } from '../common/crypto/password';
import { buildOtpauthUrl, generateTotpSecret, verifyTotp } from '../common/crypto/totp';
import { formatBackupCode, generateBackupCode, hashLookupCode, normalizeCode } from '../common/crypto/codes';
import { RequestAccount, SessionPayload } from '../common/types';

export interface LoginContext {
  ip: string;
  userAgent: string;
}

export interface SessionIssued {
  stage: 'session';
  token: string;
  expiresAt: Date;
  profile: AccountProfile;
}

export interface TotpRequired {
  stage: 'totp';
  ticket: string;
}

export type LoginResult = SessionIssued | TotpRequired;

export interface AccountProfile {
  id: string;
  login: string;
  fullName: string;
  role: AccountRole;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  hasPin: boolean;
  pinIntervalMinutes: number;
  locked: boolean;
  /** Что осталось сделать до полноценной работы */
  setupStep: 'password' | 'totp' | 'pin' | 'done';
  unusedBackupCodes: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private sessionDays(): number {
    return Number(this.config.get('SESSION_DAYS', 90));
  }

  private issuerName(): string {
    return this.config.get<string>('TOTP_ISSUER', 'Психолоджик');
  }

  async login(login: string, password: string, ctx: LoginContext): Promise<LoginResult> {
    const account = await this.prisma.account.findFirst({
      where: { login: login.trim().toLowerCase(), deletedAt: null },
    });
    // Сравниваем пароль даже для несуществующего логина — иначе по времени
    // ответа можно перебрать список пользователей.
    const stored = account?.passwordHash ?? (await this.dummyHash());
    const valid = await verifySecret(password, stored);
    if (!account || !valid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (account.totpEnabled && account.totpSecret) {
      const ticket = await this.jwt.signAsync(
        { sub: account.id, purpose: 'totp' },
        { expiresIn: '5m' },
      );
      return { stage: 'totp', ticket };
    }

    return this.issueSession(account.id, ctx);
  }

  private dummyHashCache: string | null = null;

  private async dummyHash(): Promise<string> {
    if (!this.dummyHashCache) {
      this.dummyHashCache = await hashSecret('пароль-которого-нет');
    }
    return this.dummyHashCache;
  }

  async completeTotpLogin(ticket: string, code: string, ctx: LoginContext): Promise<SessionIssued> {
    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(ticket);
    } catch {
      throw new UnauthorizedException('Срок подтверждения истёк, войдите заново');
    }
    if (payload.purpose !== 'totp') {
      throw new UnauthorizedException('Некорректный запрос');
    }

    const account = await this.prisma.account.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });
    if (!account?.totpSecret) {
      throw new UnauthorizedException('Учётная запись недоступна');
    }

    const clean = code.trim();
    const isTotp = /^\d{6}$/.test(clean) && verifyTotp(account.totpSecret, clean);
    if (!isTotp && !(await this.consumeBackupCode(account.id, clean))) {
      throw new UnauthorizedException('Неверный код подтверждения');
    }

    return this.issueSession(account.id, ctx);
  }

  private async consumeBackupCode(accountId: string, input: string): Promise<boolean> {
    const normalized = normalizeCode(input);
    if (normalized.length !== 10) {
      return false;
    }
    const record = await this.prisma.backupCode.findFirst({
      where: { accountId, codeHash: hashLookupCode(normalized), usedAt: null },
    });
    if (!record) {
      return false;
    }
    await this.prisma.backupCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return true;
  }

  private async issueSession(accountId: string, ctx: LoginContext): Promise<SessionIssued> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const expiresAt = new Date(Date.now() + this.sessionDays() * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: { accountId, expiresAt, ip: ctx.ip, userAgent: ctx.userAgent },
    });
    const payload: SessionPayload = { sid: session.id, sub: accountId, role: account.role };
    const token = await this.jwt.signAsync(payload, { expiresIn: `${this.sessionDays()}d` });
    return { stage: 'session', token, expiresAt, profile: await this.profile(accountId, session.id) };
  }

  async profile(accountId: string, sessionId?: string): Promise<AccountProfile> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      include: {
        backupCodes: { where: { usedAt: null }, select: { id: true } },
      },
    });
    if (!account) {
      throw new UnauthorizedException();
    }

    let locked = false;
    if (sessionId && account.pinHash) {
      const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
      if (session) {
        locked = Date.now() - session.lastUnlockAt.getTime() > account.pinIntervalMinutes * 60_000;
      }
    }

    let setupStep: AccountProfile['setupStep'] = 'done';
    if (account.mustChangePassword) {
      setupStep = 'password';
    } else if (account.role === AccountRole.PSYCHOLOGIST && !account.totpEnabled) {
      setupStep = 'totp';
    } else if (account.role === AccountRole.PSYCHOLOGIST && !account.pinHash) {
      setupStep = 'pin';
    }

    return {
      id: account.id,
      login: account.login,
      fullName: account.fullName,
      role: account.role,
      mustChangePassword: account.mustChangePassword,
      totpEnabled: account.totpEnabled,
      hasPin: Boolean(account.pinHash),
      pinIntervalMinutes: account.pinIntervalMinutes,
      locked,
      setupStep,
      unusedBackupCodes: account.backupCodes.length,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.account.findFirstOrThrow({ where: { id: accountId, deletedAt: null } });
    if (!(await verifySecret(currentPassword, account.passwordHash))) {
      throw new BadRequestException('Текущий пароль указан неверно');
    }
    if (await verifySecret(newPassword, account.passwordHash)) {
      throw new BadRequestException('Новый пароль должен отличаться от текущего');
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        passwordHash: await hashSecret(newPassword),
        mustChangePassword: false,
        tempPassword: null,
      },
    });
  }

  /** Готовит секрет и ссылку для приложения-аутентификатора. */
  async startTotpSetup(accountId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const account = await this.prisma.account.findFirstOrThrow({ where: { id: accountId, deletedAt: null } });
    if (account.totpEnabled) {
      throw new BadRequestException('Двухфакторная аутентификация уже подключена');
    }
    const secret = generateTotpSecret();
    await this.prisma.account.update({ where: { id: accountId }, data: { totpSecret: secret } });
    return { secret, otpauthUrl: buildOtpauthUrl(secret, account.login, this.issuerName()) };
  }

  /** Подтверждает подключение TOTP и выдаёт резервные коды — они видны один раз. */
  async confirmTotpSetup(accountId: string, code: string): Promise<{ backupCodes: string[] }> {
    const account = await this.prisma.account.findFirstOrThrow({ where: { id: accountId, deletedAt: null } });
    if (account.totpEnabled) {
      throw new BadRequestException('Двухфакторная аутентификация уже подключена');
    }
    if (!account.totpSecret) {
      throw new BadRequestException('Сначала запросите секретный ключ');
    }
    if (!verifyTotp(account.totpSecret, code)) {
      throw new BadRequestException('Код неверный. Проверьте время на телефоне и попробуйте снова');
    }

    const codes = Array.from({ length: 10 }, () => generateBackupCode());
    await this.prisma.$transaction([
      this.prisma.account.update({ where: { id: accountId }, data: { totpEnabled: true } }),
      this.prisma.backupCode.deleteMany({ where: { accountId } }),
      this.prisma.backupCode.createMany({
        data: codes.map((c) => ({ accountId, codeHash: hashLookupCode(c) })),
      }),
    ]);
    return { backupCodes: codes.map(formatBackupCode) };
  }

  async regenerateBackupCodes(accountId: string): Promise<{ backupCodes: string[] }> {
    const account = await this.prisma.account.findFirstOrThrow({ where: { id: accountId, deletedAt: null } });
    if (!account.totpEnabled) {
      throw new BadRequestException('Двухфакторная аутентификация не подключена');
    }
    const codes = Array.from({ length: 10 }, () => generateBackupCode());
    await this.prisma.$transaction([
      this.prisma.backupCode.deleteMany({ where: { accountId } }),
      this.prisma.backupCode.createMany({
        data: codes.map((c) => ({ accountId, codeHash: hashLookupCode(c) })),
      }),
    ]);
    return { backupCodes: codes.map(formatBackupCode) };
  }

  async setPin(accountId: string, pin: string, currentPin?: string, intervalMinutes?: number): Promise<void> {
    const account = await this.prisma.account.findFirstOrThrow({ where: { id: accountId, deletedAt: null } });
    if (account.pinHash) {
      if (!currentPin || !(await verifySecret(currentPin, account.pinHash))) {
        throw new BadRequestException('Текущий ПИН-код указан неверно');
      }
    }
    if (/^(\d)\1+$/.test(pin)) {
      throw new BadRequestException('ПИН-код из одинаковых цифр слишком простой');
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        pinHash: await hashSecret(pin),
        ...(intervalMinutes ? { pinIntervalMinutes: intervalMinutes } : {}),
      },
    });
    await this.touchUnlock(accountId);
  }

  private async touchUnlock(accountId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { lastUnlockAt: new Date() },
    });
  }

  /** Снимает блокировку сессии по ПИН-коду, не разлогинивая психолога. */
  async unlock(account: RequestAccount, pin: string): Promise<void> {
    const record = await this.prisma.account.findFirstOrThrow({ where: { id: account.id, deletedAt: null } });
    if (!record.pinHash) {
      throw new BadRequestException('ПИН-код не задан');
    }
    if (!(await verifySecret(pin, record.pinHash))) {
      throw new ForbiddenException('Неверный ПИН-код');
    }
    await this.prisma.authSession.update({
      where: { id: account.sessionId },
      data: { lastUnlockAt: new Date() },
    });
  }

  /** Немедленно «залипает» сессия — кнопка «Заблокировать» в интерфейсе. */
  async lock(sessionId: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastUnlockAt: new Date(0) },
    });
  }

  async listSessions(accountId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { accountId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      current: s.id === currentSessionId,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      ip: s.ip,
      userAgent: s.userAgent,
    }));
  }

  async revokeSession(accountId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Сессия не найдена');
    }
  }

  async revokeOtherSessions(accountId: string, keepSessionId: string): Promise<{ revoked: number }> {
    const result = await this.prisma.authSession.updateMany({
      where: { accountId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }
}
