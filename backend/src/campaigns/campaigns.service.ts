import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InviteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatInviteCode, generateInviteCode } from '../common/crypto/codes';
import { className } from '../common/text';
import { AddClassesDto, CreateCampaignDto } from './dto/campaigns.dto';

export interface CampaignClassStats {
  classId: string;
  className: string;
  homeroomTeacher: string;
  issued: number;
  used: number;
  revoked: number;
}

export interface CampaignRow {
  id: string;
  title: string;
  testId: string;
  testTitle: string;
  authorName: string;
  classes: CampaignClassStats[];
  totalIssued: number;
  totalUsed: number;
  createdAt: string;
  expiresAt: string | null;
  closedAt: string | null;
}

export interface PrintCode {
  code: string;
  formatted: string;
  seq: number;
  url: string;
  used: boolean;
}

export interface PrintSheet {
  campaignId: string;
  title: string;
  testTitle: string;
  baseUrl: string;
  createdAt: string;
  expiresAt: string | null;
  classes: { classId: string; className: string; homeroomTeacher: string; codes: PrintCode[] }[];
}

const campaignInclude = {
  test: { select: { id: true, title: true } },
  createdBy: { select: { fullName: true } },
  invites: { include: { class: true }, orderBy: [{ classId: 'asc' }, { seq: 'asc' }] },
} satisfies Prisma.CampaignInclude;

type CampaignWithRelations = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl(): string {
    return this.config.get<string>('PUBLIC_URL', 'http://localhost:5173').replace(/\/+$/, '');
  }

  /**
   * Коды генерируются пачкой и проверяются на коллизию одним запросом:
   * 32^8 вариантов, но лучше убедиться, чем поймать 500 на уникальном индексе.
   */
  private async freshCodes(count: number): Promise<string[]> {
    const codes = new Set<string>();
    for (let attempt = 0; attempt < 10 && codes.size < count; attempt += 1) {
      while (codes.size < count) {
        codes.add(generateInviteCode());
      }
      const taken = await this.prisma.invite.findMany({
        where: { code: { in: [...codes] } },
        select: { code: true },
      });
      for (const row of taken) {
        codes.delete(row.code);
      }
    }
    if (codes.size < count) {
      throw new BadRequestException('Не удалось сгенерировать коды, повторите попытку');
    }
    return [...codes];
  }

  private toRow(campaign: CampaignWithRelations): CampaignRow {
    const byClass = new Map<string, CampaignClassStats>();
    for (const invite of campaign.invites) {
      const entry = byClass.get(invite.classId) ?? {
        classId: invite.classId,
        className: className(invite.class.number, invite.class.letter),
        homeroomTeacher: invite.class.homeroomTeacher,
        issued: 0,
        used: 0,
        revoked: 0,
      };
      entry.issued += 1;
      if (invite.status === InviteStatus.USED) {
        entry.used += 1;
      }
      if (invite.status === InviteStatus.REVOKED) {
        entry.revoked += 1;
      }
      byClass.set(invite.classId, entry);
    }
    const classes = [...byClass.values()].sort((a, b) =>
      a.className.localeCompare(b.className, 'ru', { numeric: true }),
    );
    return {
      id: campaign.id,
      title: campaign.title,
      testId: campaign.test.id,
      testTitle: campaign.test.title,
      authorName: campaign.createdBy.fullName,
      classes,
      totalIssued: classes.reduce((sum, c) => sum + c.issued, 0),
      totalUsed: classes.reduce((sum, c) => sum + c.used, 0),
      createdAt: campaign.createdAt.toISOString(),
      expiresAt: campaign.expiresAt ? campaign.expiresAt.toISOString() : null,
      closedAt: campaign.closedAt ? campaign.closedAt.toISOString() : null,
    };
  }

  async list(): Promise<CampaignRow[]> {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: campaignInclude,
    });
    return campaigns.map((c) => this.toRow(c));
  }

  async one(id: string): Promise<CampaignRow> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    return this.toRow(campaign);
  }

  async create(accountId: string, dto: CreateCampaignDto): Promise<CampaignRow> {
    const test = await this.prisma.test.findFirst({ where: { id: dto.testId, deletedAt: null } });
    if (!test) {
      throw new NotFoundException('Тест не найден');
    }
    if (!test.isPublished) {
      throw new BadRequestException('Тест не опубликован — ученики его не увидят');
    }

    const classes = await this.prisma.schoolClass.findMany({
      where: { id: { in: dto.classIds }, archivedAt: null },
    });
    if (classes.length !== dto.classIds.length) {
      throw new BadRequestException('Часть классов не найдена или отправлена в архив');
    }

    const spare = dto.spare ?? 2;
    const plan = classes.map((c) => ({ cls: c, count: Math.max(1, c.plannedSize + spare) }));
    const total = plan.reduce((sum, p) => sum + p.count, 0);
    if (total > 2000) {
      throw new BadRequestException('Слишком много кодов за один раз — разбейте на несколько выдач');
    }

    const codes = await this.freshCodes(total);
    let cursor = 0;
    const invites: Prisma.InviteCreateManyCampaignInput[] = [];
    for (const { cls, count } of plan) {
      for (let seq = 1; seq <= count; seq += 1) {
        invites.push({ code: codes[cursor], classId: cls.id, seq });
        cursor += 1;
      }
    }

    const created = await this.prisma.campaign.create({
      data: {
        title: dto.title?.trim() || test.title,
        testId: test.id,
        createdById: accountId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        invites: { createMany: { data: invites } },
      },
      include: campaignInclude,
    });
    return this.toRow(created);
  }

  /** Докинуть классы в уже созданную выдачу — коды прежних классов не трогаем. */
  async addClasses(id: string, dto: AddClassesDto): Promise<CampaignRow> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    if (campaign.closedAt) {
      throw new BadRequestException('Выдача закрыта');
    }

    const existing = await this.prisma.invite.findMany({
      where: { campaignId: id, classId: { in: dto.classIds } },
      select: { classId: true },
      distinct: ['classId'],
    });
    const already = new Set(existing.map((e) => e.classId));
    const fresh = dto.classIds.filter((c) => !already.has(c));
    if (!fresh.length) {
      throw new BadRequestException('Эти классы уже в выдаче');
    }

    const classes = await this.prisma.schoolClass.findMany({
      where: { id: { in: fresh }, archivedAt: null },
    });
    const spare = dto.spare ?? 2;
    const plan = classes.map((c) => ({ cls: c, count: Math.max(1, c.plannedSize + spare) }));
    const codes = await this.freshCodes(plan.reduce((sum, p) => sum + p.count, 0));

    let cursor = 0;
    const invites: Prisma.InviteCreateManyInput[] = [];
    for (const { cls, count } of plan) {
      for (let seq = 1; seq <= count; seq += 1) {
        invites.push({ campaignId: id, code: codes[cursor], classId: cls.id, seq });
        cursor += 1;
      }
    }
    await this.prisma.invite.createMany({ data: invites });
    return this.one(id);
  }

  /** Довыпустить коды одному классу — например, пришли новенькие. */
  async addCodes(id: string, classId: string, count: number): Promise<CampaignRow> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    if (campaign.closedAt) {
      throw new BadRequestException('Выдача закрыта');
    }
    const last = await this.prisma.invite.aggregate({
      where: { campaignId: id, classId },
      _max: { seq: true },
    });
    const codes = await this.freshCodes(count);
    const start = (last._max.seq ?? 0) + 1;
    await this.prisma.invite.createMany({
      data: codes.map((code, index) => ({ campaignId: id, classId, code, seq: start + index })),
    });
    return this.one(id);
  }

  /** Лист для печати: только неиспользованные коды, если не сказано иначе. */
  async sheet(id: string, includeUsed = false): Promise<PrintSheet> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    const base = this.baseUrl();

    const byClass = new Map<string, PrintSheet['classes'][number]>();
    for (const invite of campaign.invites) {
      if (invite.status === InviteStatus.REVOKED) {
        continue;
      }
      if (!includeUsed && invite.status === InviteStatus.USED) {
        continue;
      }
      const entry = byClass.get(invite.classId) ?? {
        classId: invite.classId,
        className: className(invite.class.number, invite.class.letter),
        homeroomTeacher: invite.class.homeroomTeacher,
        codes: [],
      };
      entry.codes.push({
        code: invite.code,
        formatted: formatInviteCode(invite.code),
        seq: invite.seq,
        url: `${base}/t/${invite.code}`,
        used: invite.status === InviteStatus.USED,
      });
      byClass.set(invite.classId, entry);
    }

    return {
      campaignId: campaign.id,
      title: campaign.title,
      testTitle: campaign.test.title,
      baseUrl: base,
      createdAt: campaign.createdAt.toISOString(),
      expiresAt: campaign.expiresAt ? campaign.expiresAt.toISOString() : null,
      classes: [...byClass.values()].sort((a, b) =>
        a.className.localeCompare(b.className, 'ru', { numeric: true }),
      ),
    };
  }

  /** Закрытие выдачи гасит все ещё не использованные коды. */
  async close(id: string): Promise<CampaignRow> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    await this.prisma.$transaction([
      this.prisma.invite.updateMany({
        where: { campaignId: id, status: InviteStatus.ISSUED },
        data: { status: InviteStatus.REVOKED },
      }),
      this.prisma.campaign.update({ where: { id }, data: { closedAt: new Date() } }),
    ]);
    return this.one(id);
  }

  async reopen(id: string): Promise<CampaignRow> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Выдача не найдена');
    }
    await this.prisma.$transaction([
      this.prisma.invite.updateMany({
        where: { campaignId: id, status: InviteStatus.REVOKED },
        data: { status: InviteStatus.ISSUED },
      }),
      this.prisma.campaign.update({ where: { id }, data: { closedAt: null } }),
    ]);
    return this.one(id);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const used = await this.prisma.invite.count({ where: { campaignId: id, status: InviteStatus.USED } });
    if (used > 0) {
      throw new BadRequestException(
        'По этой выдаче уже проходили тест — её можно только закрыть, чтобы не потерять связь с результатами',
      );
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }
}
