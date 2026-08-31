import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InviteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { TestsService, TakingTestView } from '../tests/tests.service';
import { QuestionOptions } from '../tests/question-options';
import { AnswerView, ResponseItem, scoreResponses } from '../tests/scoring';
import { normalizeCode } from '../common/crypto/codes';
import { className } from '../common/text';
import { IdentifyDto, RunQueryDto } from './dto/runs.dto';

/** Токен прохождения живёт три урока — этого хватит любому тесту. */
const RUN_TOKEN_TTL = '3h';

export type InviteState =
  | { stage: 'identify'; className: string; test: Omit<TakingTestView, 'questions'> & { questionCount: number } }
  | { stage: 'resume'; className: string; runToken: string; test: TakingTestView; studentName: string };

export interface SubmitOutcome {
  ok: true;
  showResult: boolean;
  score?: number;
  maxScore?: number;
  interpretationLabel?: string | null;
  interpretationText?: string | null;
}

export interface RunRow {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  className: string;
  classId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  interpretationLabel: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface RunDetail extends RunRow {
  interpretationText: string | null;
  studentOrigin: string;
  instructions: string;
  answers: AnswerView[];
}

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tests: TestsService,
    private readonly students: StudentsService,
  ) {}

  private async loadInvite(rawCode: string) {
    const code = normalizeCode(rawCode);
    if (code.length !== 8) {
      throw new NotFoundException('Код не найден. Проверь, что переписал его правильно');
    }
    const invite = await this.prisma.invite.findUnique({
      where: { code },
      include: {
        class: true,
        campaign: { include: { test: true } },
        run: true,
      },
    });
    if (!invite) {
      throw new NotFoundException('Код не найден. Проверь, что переписал его правильно');
    }
    return invite;
  }

  private assertUsable(invite: Awaited<ReturnType<RunsService['loadInvite']>>): void {
    if (invite.status === InviteStatus.REVOKED) {
      throw new GoneException('Этот код больше не действует. Обратись к психологу');
    }
    if (invite.campaign.closedAt) {
      throw new GoneException('Тестирование уже завершено');
    }
    if (invite.campaign.expiresAt && invite.campaign.expiresAt < new Date()) {
      throw new GoneException('Срок прохождения истёк. Обратись к психологу');
    }
    if (invite.campaign.test.deletedAt) {
      throw new GoneException('Тест больше недоступен');
    }
  }

  private signRunToken(runId: string): Promise<string> {
    return this.jwt.signAsync({ sub: runId, purpose: 'run' }, { expiresIn: RUN_TOKEN_TTL });
  }

  /** Что показать по коду: форму с ФИО или продолжение начатого прохождения. */
  async inspect(rawCode: string): Promise<InviteState> {
    const invite = await this.loadInvite(rawCode);
    this.assertUsable(invite);

    const name = className(invite.class.number, invite.class.letter);

    if (invite.status === InviteStatus.USED) {
      if (!invite.run) {
        throw new GoneException('Этот код уже использован');
      }
      if (invite.run.completedAt) {
        throw new ConflictException('Ты уже прошёл этот тест. Спасибо!');
      }
      // Связь оборвалась посреди теста — даём продолжить по тому же коду.
      const student = await this.prisma.student.findUnique({ where: { id: invite.run.studentId } });
      return {
        stage: 'resume',
        className: name,
        runToken: await this.signRunToken(invite.run.id),
        test: await this.tests.getForTaking(invite.campaign.testId),
        studentName: student ? `${student.lastName} ${student.firstName}` : '',
      };
    }

    const test = await this.tests.getForTaking(invite.campaign.testId);
    return {
      stage: 'identify',
      className: name,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        instructions: test.instructions,
        questionCount: test.questions.length,
      },
    };
  }

  /**
   * Ученик подписался — гасим код и заводим прохождение. Код одноразовый:
   * после этого по нему можно только дописать начатое, но не начать заново.
   */
  async start(rawCode: string, dto: IdentifyDto): Promise<{ runToken: string; test: TakingTestView; className: string }> {
    const invite = await this.loadInvite(rawCode);
    this.assertUsable(invite);
    if (invite.status === InviteStatus.USED) {
      throw new ConflictException('Этот код уже использован');
    }

    const runId = await this.prisma.$transaction(async (tx) => {
      // Повторная проверка внутри транзакции: два одновременных запроса
      // по одному коду не должны создать два прохождения.
      const locked = await tx.invite.updateMany({
        where: { id: invite.id, status: InviteStatus.ISSUED },
        data: { status: InviteStatus.USED, usedAt: new Date() },
      });
      if (locked.count === 0) {
        throw new ConflictException('Этот код уже использован');
      }

      const student = await this.students.resolveForRun(tx, invite.classId, dto.lastName, dto.firstName);
      const run = await tx.testRun.create({
        data: {
          testId: invite.campaign.testId,
          studentId: student.id,
          classId: invite.classId,
          campaignId: invite.campaignId,
          inviteId: invite.id,
        },
        select: { id: true },
      });
      return run.id;
    });

    return {
      runToken: await this.signRunToken(runId),
      test: await this.tests.getForTaking(invite.campaign.testId),
      className: className(invite.class.number, invite.class.letter),
    };
  }

  async submit(runToken: string, responses: ResponseItem[]): Promise<SubmitOutcome> {
    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(runToken);
    } catch {
      throw new BadRequestException('Время на прохождение истекло. Обратись к психологу за новым кодом');
    }
    if (payload.purpose !== 'run') {
      throw new BadRequestException('Некорректный запрос');
    }

    const run = await this.prisma.testRun.findUnique({
      where: { id: payload.sub },
      include: {
        test: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            interpretations: { orderBy: { minScore: 'asc' } },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Прохождение не найдено');
    }
    if (run.completedAt) {
      throw new ConflictException('Ответы уже отправлены');
    }

    const result = scoreResponses(
      run.test.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options as QuestionOptions,
      })),
      responses,
    );

    const match = run.test.interpretations.find(
      (i) => result.score >= i.minScore && result.score <= i.maxScore,
    );

    await this.prisma.testRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        score: result.score,
        maxScore: result.maxScore,
        interpretationLabel: match?.label ?? null,
        interpretationText: match?.text ?? null,
        answers: result.answers as unknown as Prisma.InputJsonValue,
      },
    });

    if (!run.test.showResult) {
      return { ok: true, showResult: false };
    }
    return {
      ok: true,
      showResult: true,
      score: result.score,
      maxScore: result.maxScore,
      interpretationLabel: match?.label ?? null,
      interpretationText: match?.text ?? null,
    };
  }

  // ─── Кабинет психолога ───────────────────────────────────────────────────

  private toRow(run: {
    id: string;
    testId: string;
    test: { title: string };
    studentId: string;
    student: { lastName: string; firstName: string };
    classId: string;
    class: { number: number; letter: string };
    campaignId: string | null;
    campaign: { title: string } | null;
    score: number | null;
    maxScore: number | null;
    interpretationLabel: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }): RunRow {
    return {
      id: run.id,
      testId: run.testId,
      testTitle: run.test.title,
      studentId: run.studentId,
      studentName: `${run.student.lastName} ${run.student.firstName}`,
      className: className(run.class.number, run.class.letter),
      classId: run.classId,
      campaignId: run.campaignId,
      campaignTitle: run.campaign?.title ?? null,
      score: run.score,
      maxScore: run.maxScore,
      percent:
        run.score !== null && run.maxScore ? Math.round((run.score / run.maxScore) * 100) : null,
      interpretationLabel: run.interpretationLabel,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    };
  }

  async list(query: RunQueryDto): Promise<RunRow[]> {
    const search = query.search?.trim();
    const runs = await this.prisma.testRun.findMany({
      where: {
        completedAt: { not: null },
        ...(query.testId ? { testId: query.testId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(search
          ? {
              student: {
                OR: [
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { firstName: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      orderBy: { completedAt: 'desc' },
      take: 500,
      include: {
        test: { select: { title: true } },
        student: { select: { lastName: true, firstName: true } },
        class: true,
        campaign: { select: { title: true } },
      },
    });
    return runs.map((r) => this.toRow(r));
  }

  async detail(id: string): Promise<RunDetail> {
    const run = await this.prisma.testRun.findUnique({
      where: { id },
      include: {
        test: { select: { title: true, instructions: true } },
        student: { select: { lastName: true, firstName: true, origin: true } },
        class: true,
        campaign: { select: { title: true } },
      },
    });
    if (!run) {
      throw new NotFoundException('Результат не найден');
    }
    return {
      ...this.toRow({ ...run, test: { title: run.test.title } }),
      interpretationText: run.interpretationText,
      studentOrigin: run.student.origin,
      instructions: run.test.instructions,
      answers: (run.answers as unknown as AnswerView[]) ?? [],
    };
  }

  async remove(id: string): Promise<{ ok: true }> {
    const run = await this.prisma.testRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException('Результат не найден');
    }
    await this.prisma.testRun.delete({ where: { id } });
    return { ok: true };
  }

  /** Экспорт результатов в CSV — открывается в Excel и Google Таблицах. */
  async exportCsv(query: RunQueryDto): Promise<string> {
    const runs = await this.list(query);
    const header = ['Фамилия и имя', 'Класс', 'Тест', 'Балл', 'Максимум', 'Процент', 'Уровень', 'Дата'];
    const escape = (value: string | number | null) => {
      const text = value === null ? '' : String(value);
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = runs.map((r) =>
      [
        r.studentName,
        r.className,
        r.testTitle,
        r.score,
        r.maxScore,
        r.percent,
        r.interpretationLabel,
        r.completedAt ? new Date(r.completedAt).toLocaleString('ru-RU') : '',
      ]
        .map(escape)
        .join(';'),
    );
    // BOM — иначе Excel открывает кириллицу кракозябрами.
    return `﻿${[header.join(';'), ...rows].join('\r\n')}`;
  }

  /** Незавершённые прохождения: ученик начал и закрыл вкладку. */
  async abandoned(): Promise<RunRow[]> {
    const runs = await this.prisma.testRun.findMany({
      where: { completedAt: null, startedAt: { lt: new Date(Date.now() - 3 * 60 * 60 * 1000) } },
      orderBy: { startedAt: 'desc' },
      take: 200,
      include: {
        test: { select: { title: true } },
        student: { select: { lastName: true, firstName: true } },
        class: true,
        campaign: { select: { title: true } },
      },
    });
    return runs.map((r) => this.toRow(r));
  }
}
