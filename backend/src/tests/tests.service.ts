import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionOptions, stripScores, TakingQuestionOptions } from './question-options';
import { maxScoreFor } from './scoring';
import { BUILT_IN_TESTS } from './built-in';
import { CreateTestDto, InterpretationDto, QuestionDto, UpdateTestDto } from './dto/tests.dto';

export interface QuestionView {
  id: string;
  text: string;
  order: number;
  type: QuestionType;
  options: QuestionOptions;
}

export interface InterpretationView {
  id: string;
  minScore: number;
  maxScore: number;
  label: string;
  text: string;
  color: string;
  order: number;
}

export interface TestSummary {
  id: string;
  title: string;
  description: string;
  isBuiltIn: boolean;
  isPublished: boolean;
  showResult: boolean;
  questionCount: number;
  maxScore: number;
  runCount: number;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestView extends TestSummary {
  instructions: string;
  questions: QuestionView[];
  interpretations: InterpretationView[];
}

/** То, что уходит ученику: без баллов и без интерпретаций. */
export interface TakingTestView {
  id: string;
  title: string;
  description: string;
  instructions: string;
  questions: { id: string; text: string; order: number; type: QuestionType; options: TakingQuestionOptions }[];
}

function optionsToJson(options?: QuestionDto['options']): Prisma.InputJsonValue {
  return (options ?? {}) as unknown as Prisma.InputJsonValue;
}

/** Диапазоны интерпретаций не должны пересекаться — иначе результат случаен. */
function assertRanges(interpretations: InterpretationDto[]): void {
  const sorted = [...interpretations].sort((a, b) => a.minScore - b.minScore);
  for (const item of sorted) {
    if (item.minScore > item.maxScore) {
      throw new BadRequestException(`Уровень «${item.label}»: начало диапазона больше конца`);
    }
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].minScore <= sorted[i - 1].maxScore) {
      throw new BadRequestException(
        `Диапазоны «${sorted[i - 1].label}» и «${sorted[i].label}» пересекаются`,
      );
    }
  }
}

function assertQuestions(questions: QuestionDto[]): void {
  for (const question of questions) {
    if (question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.MULTIPLE_CHOICE) {
      if (!question.options?.choices?.length) {
        throw new BadRequestException(`У вопроса «${question.text.slice(0, 40)}» нет вариантов ответа`);
      }
    }
    if (question.type === QuestionType.SCALE) {
      const min = question.options?.min ?? 0;
      const max = question.options?.max ?? 10;
      if (min >= max) {
        throw new BadRequestException(`У вопроса «${question.text.slice(0, 40)}» некорректная шкала`);
      }
    }
  }
}

@Injectable()
export class TestsService implements OnModuleInit {
  private readonly logger = new Logger(TestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Встроенные методики досеиваются при каждом старте — обновление их подтянет. */
  async onModuleInit(): Promise<void> {
    for (const test of BUILT_IN_TESTS) {
      const existing = await this.prisma.test.findUnique({ where: { builtInKey: test.key } });
      if (existing) {
        continue;
      }
      await this.prisma.test.create({
        data: {
          builtInKey: test.key,
          title: test.title,
          description: test.description,
          instructions: test.instructions,
          isBuiltIn: true,
          isPublished: true,
          showResult: test.showResult,
          questions: {
            create: test.questions.map((q, index) => ({
              text: q.text,
              order: index,
              type: q.type,
              options: q.options as unknown as Prisma.InputJsonValue,
            })),
          },
          interpretations: {
            create: test.interpretations.map((i, index) => ({
              minScore: i.minScore,
              maxScore: i.maxScore,
              label: i.label,
              text: i.text,
              color: i.color,
              order: index,
            })),
          },
        },
      });
      this.logger.log(`Добавлена встроенная методика: ${test.title}`);
    }
  }

  async list(): Promise<TestSummary[]> {
    const tests = await this.prisma.test.findMany({
      where: { deletedAt: null },
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
      include: {
        questions: true,
        createdBy: { select: { fullName: true } },
        _count: { select: { runs: true } },
      },
    });
    return tests.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      isBuiltIn: t.isBuiltIn,
      isPublished: t.isPublished,
      showResult: t.showResult,
      questionCount: t.questions.length,
      maxScore: maxScoreFor(
        t.questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          options: q.options as QuestionOptions,
        })),
      ),
      runCount: t._count.runs,
      authorName: t.createdBy?.fullName ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async getFull(id: string): Promise<TestView> {
    const test = await this.prisma.test.findFirst({
      where: { id, deletedAt: null },
      include: {
        questions: { orderBy: { order: 'asc' } },
        interpretations: { orderBy: { minScore: 'asc' } },
        createdBy: { select: { fullName: true } },
        _count: { select: { runs: true } },
      },
    });
    if (!test) {
      throw new NotFoundException('Тест не найден');
    }
    const questions = test.questions.map((q) => ({
      id: q.id,
      text: q.text,
      order: q.order,
      type: q.type,
      options: q.options as QuestionOptions,
    }));
    return {
      id: test.id,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      isBuiltIn: test.isBuiltIn,
      isPublished: test.isPublished,
      showResult: test.showResult,
      questionCount: questions.length,
      maxScore: maxScoreFor(questions),
      runCount: test._count.runs,
      authorName: test.createdBy?.fullName ?? null,
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
      questions,
      interpretations: test.interpretations.map((i) => ({
        id: i.id,
        minScore: i.minScore,
        maxScore: i.maxScore,
        label: i.label,
        text: i.text,
        color: i.color,
        order: i.order,
      })),
    };
  }

  async getForTaking(id: string): Promise<TakingTestView> {
    const full = await this.getFull(id);
    return {
      id: full.id,
      title: full.title,
      description: full.description,
      instructions: full.instructions,
      questions: full.questions.map((q) => ({
        id: q.id,
        text: q.text,
        order: q.order,
        type: q.type,
        options: stripScores(q.options),
      })),
    };
  }

  async create(accountId: string, dto: CreateTestDto): Promise<TestView> {
    assertQuestions(dto.questions);
    assertRanges(dto.interpretations ?? []);

    const test = await this.prisma.test.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        instructions: dto.instructions?.trim() ?? '',
        isPublished: dto.isPublished ?? false,
        showResult: dto.showResult ?? false,
        createdById: accountId,
        questions: {
          create: dto.questions.map((q, index) => ({
            text: q.text.trim(),
            order: q.order ?? index,
            type: q.type,
            options: optionsToJson(q.options),
          })),
        },
        interpretations: {
          create: (dto.interpretations ?? []).map((i, index) => ({
            minScore: i.minScore,
            maxScore: i.maxScore,
            label: i.label.trim(),
            text: i.text?.trim() ?? '',
            color: i.color ?? 'info',
            order: i.order ?? index,
          })),
        },
      },
      select: { id: true },
    });
    return this.getFull(test.id);
  }

  private async editable(id: string) {
    const test = await this.prisma.test.findFirst({ where: { id, deletedAt: null } });
    if (!test) {
      throw new NotFoundException('Тест не найден');
    }
    if (test.isBuiltIn) {
      throw new ForbiddenException('Встроенную методику нельзя изменить — сделайте копию и правьте её');
    }
    return test;
  }

  async update(id: string, dto: UpdateTestDto): Promise<TestView> {
    await this.editable(id);
    if (dto.questions) {
      assertQuestions(dto.questions);
    }
    if (dto.interpretations) {
      assertRanges(dto.interpretations);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.instructions !== undefined ? { instructions: dto.instructions.trim() } : {}),
          ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
          ...(dto.showResult !== undefined ? { showResult: dto.showResult } : {}),
        },
      });
      if (dto.questions) {
        await tx.question.deleteMany({ where: { testId: id } });
        await tx.question.createMany({
          data: dto.questions.map((q, index) => ({
            testId: id,
            text: q.text.trim(),
            order: q.order ?? index,
            type: q.type,
            options: optionsToJson(q.options),
          })),
        });
      }
      if (dto.interpretations) {
        await tx.interpretation.deleteMany({ where: { testId: id } });
        await tx.interpretation.createMany({
          data: dto.interpretations.map((i, index) => ({
            testId: id,
            minScore: i.minScore,
            maxScore: i.maxScore,
            label: i.label.trim(),
            text: i.text?.trim() ?? '',
            color: i.color ?? 'info',
            order: i.order ?? index,
          })),
        });
      }
    });

    return this.getFull(id);
  }

  /** Копия методики — единственный способ «отредактировать» встроенный тест. */
  async duplicate(id: string, accountId: string, title?: string): Promise<TestView> {
    const source = await this.getFull(id);
    const copy = await this.prisma.test.create({
      data: {
        title: (title?.trim() || `${source.title} (копия)`).slice(0, 200),
        description: source.description,
        instructions: source.instructions,
        isPublished: false,
        showResult: source.showResult,
        createdById: accountId,
        questions: {
          create: source.questions.map((q) => ({
            text: q.text,
            order: q.order,
            type: q.type,
            options: q.options as unknown as Prisma.InputJsonValue,
          })),
        },
        interpretations: {
          create: source.interpretations.map((i) => ({
            minScore: i.minScore,
            maxScore: i.maxScore,
            label: i.label,
            text: i.text,
            color: i.color,
            order: i.order,
          })),
        },
      },
      select: { id: true },
    });
    return this.getFull(copy.id);
  }

  async setPublished(id: string, isPublished: boolean): Promise<TestView> {
    const test = await this.prisma.test.findFirst({ where: { id, deletedAt: null } });
    if (!test) {
      throw new NotFoundException('Тест не найден');
    }
    if (isPublished) {
      const questionCount = await this.prisma.question.count({ where: { testId: id } });
      if (questionCount === 0) {
        throw new BadRequestException('Нельзя опубликовать тест без вопросов');
      }
    }
    await this.prisma.test.update({ where: { id }, data: { isPublished } });
    return this.getFull(id);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.editable(id);
    // Мягкое удаление: прохождения ссылаются на тест и должны остаться читаемыми.
    await this.prisma.test.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false } });
    return { ok: true };
  }
}
