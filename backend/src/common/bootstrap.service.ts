import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashSecret } from './crypto/password';
import { generatePassword } from './crypto/codes';

/**
 * При первом запуске в системе не должно быть ничего, кроме администратора.
 * Он не работает с учениками — только меняет свой пароль и заводит психологов.
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger('Bootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdmin();
    await this.cleanupSessions();
  }

  private async ensureAdmin(): Promise<void> {
    const login = (this.config.get<string>('ADMIN_LOGIN') ?? 'admin').trim().toLowerCase();
    const existing = await this.prisma.account.findFirst({ where: { role: AccountRole.ADMIN } });
    if (existing) {
      return;
    }

    const configured = this.config.get<string>('ADMIN_PASSWORD');
    const password = configured?.trim() || generatePassword(14);

    await this.prisma.account.create({
      data: {
        login,
        passwordHash: await hashSecret(password),
        role: AccountRole.ADMIN,
        fullName: 'Администратор',
        mustChangePassword: true,
        tempPassword: null,
      },
    });

    this.logger.warn(
      [
        '',
        '  ────────────────────────────────────────────────',
        '  Создана учётная запись администратора',
        `  Логин:  ${login}`,
        `  Пароль: ${password}`,
        '  Пароль будет запрошен к смене при первом входе.',
        '  ────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }

  /** Просроченные и отозванные сессии копятся годами — подчищаем на старте. */
  private async cleanupSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.authSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
    });
    if (result.count > 0) {
      this.logger.log(`Удалено просроченных сессий: ${result.count}`);
    }
  }
}
