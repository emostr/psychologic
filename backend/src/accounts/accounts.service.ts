import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generatePassword } from '../common/crypto/codes';
import { hashSecret } from '../common/crypto/password';
import { buildLoginBase } from '../common/text';

export interface AccountRow {
  id: string;
  login: string;
  fullName: string;
  role: AccountRole;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  /** Виден, пока психолог не сменил временный пароль. */
  tempPassword: string | null;
  activeSessions: number;
  lastSeenAt: string | null;
  createdAt: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueLogin(base: string): Promise<string> {
    let login = base;
    let suffix = 1;
    while (await this.prisma.account.findUnique({ where: { login }, select: { id: true } })) {
      suffix += 1;
      login = `${base}${suffix}`;
    }
    return login;
  }

  async createPsychologist(fullName: string, login?: string): Promise<{ account: AccountRow; temporaryPassword: string }> {
    const desired = login?.trim().toLowerCase() || buildLoginBase(fullName);
    if (login) {
      const taken = await this.prisma.account.findUnique({ where: { login: desired }, select: { id: true } });
      if (taken) {
        throw new BadRequestException('Такой логин уже занят');
      }
    }
    const finalLogin = login ? desired : await this.uniqueLogin(desired);
    const temporaryPassword = generatePassword(12);

    const created = await this.prisma.account.create({
      data: {
        login: finalLogin,
        passwordHash: await hashSecret(temporaryPassword),
        role: AccountRole.PSYCHOLOGIST,
        fullName: fullName.trim(),
        mustChangePassword: true,
        tempPassword: temporaryPassword,
      },
    });

    return { account: this.toRow(created, 0, null), temporaryPassword };
  }

  private toRow(
    account: {
      id: string;
      login: string;
      fullName: string;
      role: AccountRole;
      totpEnabled: boolean;
      mustChangePassword: boolean;
      tempPassword: string | null;
      createdAt: Date;
    },
    activeSessions: number,
    lastSeenAt: Date | null,
  ): AccountRow {
    return {
      id: account.id,
      login: account.login,
      fullName: account.fullName,
      role: account.role,
      totpEnabled: account.totpEnabled,
      mustChangePassword: account.mustChangePassword,
      tempPassword: account.mustChangePassword ? account.tempPassword : null,
      activeSessions,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
      createdAt: account.createdAt.toISOString(),
    };
  }

  async list(): Promise<AccountRow[]> {
    const now = new Date();
    const accounts = await this.prisma.account.findMany({
      where: { deletedAt: null, role: AccountRole.PSYCHOLOGIST },
      orderBy: { createdAt: 'asc' },
      include: {
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: now } },
          orderBy: { lastSeenAt: 'desc' },
          select: { lastSeenAt: true },
        },
      },
    });
    return accounts.map((a) => this.toRow(a, a.sessions.length, a.sessions[0]?.lastSeenAt ?? null));
  }

  private async psychologist(id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, deletedAt: null } });
    if (!account) {
      throw new NotFoundException('Учётная запись не найдена');
    }
    if (account.role !== AccountRole.PSYCHOLOGIST) {
      throw new ForbiddenException('Действие доступно только для учётных записей психологов');
    }
    return account;
  }

  async rename(id: string, fullName: string): Promise<AccountRow> {
    await this.psychologist(id);
    const updated = await this.prisma.account.update({ where: { id }, data: { fullName: fullName.trim() } });
    return this.toRow(updated, 0, null);
  }

  /** Психолог потерял телефон: сбрасываем TOTP, резервные коды и все сессии. */
  async resetTotp(id: string): Promise<{ ok: true }> {
    await this.psychologist(id);
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id },
        data: { totpEnabled: false, totpSecret: null },
      }),
      this.prisma.backupCode.deleteMany({ where: { accountId: id } }),
      this.prisma.authSession.updateMany({
        where: { accountId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Выдаёт новый временный пароль и завершает все сессии психолога. */
  async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
    await this.psychologist(id);
    const temporaryPassword = generatePassword(12);
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id },
        data: {
          passwordHash: await hashSecret(temporaryPassword),
          mustChangePassword: true,
          tempPassword: temporaryPassword,
        },
      }),
      this.prisma.authSession.updateMany({
        where: { accountId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { temporaryPassword };
  }

  /**
   * Мягкое удаление: созданные психологом тесты, заметки и кампании остаются,
   * иначе из архива школы пропала бы половина истории.
   */
  async remove(id: string): Promise<{ ok: true }> {
    await this.psychologist(id);
    const stamp = Date.now();
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id },
        data: { deletedAt: new Date(), login: `deleted.${stamp}.${id.slice(0, 6)}` },
      }),
      this.prisma.authSession.updateMany({
        where: { accountId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}
