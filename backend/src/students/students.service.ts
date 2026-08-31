import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildSearchKey, className, levenshtein, normalizeName, titleCase } from '../common/text';
import {
  CreateStudentDto,
  NoteDto,
  StudentQueryDto,
  TagDto,
  UpdateStudentDto,
} from './dto/students.dto';

export interface StudentRow {
  id: string;
  lastName: string;
  firstName: string;
  fullName: string;
  origin: StudentOrigin;
  classId: string;
  className: string;
  birthDate: string | null;
  comment: string;
  runCount: number;
  noteCount: number;
  lastRunAt: string | null;
  tags: { id: string; label: string; color: string }[];
  possibleDuplicateOf: { id: string; fullName: string; origin: StudentOrigin } | null;
  archived: boolean;
  createdAt: string;
}

export interface StudentDetail extends StudentRow {
  runs: {
    id: string;
    testId: string;
    testTitle: string;
    className: string;
    score: number | null;
    maxScore: number | null;
    interpretationLabel: string | null;
    completedAt: string | null;
  }[];
  notes: { id: string; text: string; authorName: string; createdAt: string; updatedAt: string }[];
}

const rowInclude = {
  class: true,
  tags: { orderBy: { createdAt: 'asc' } },
  possibleDuplicateOf: { select: { id: true, lastName: true, firstName: true, origin: true } },
  _count: { select: { runs: true, notes: true } },
  runs: {
    where: { completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 1,
    select: { completedAt: true },
  },
} satisfies Prisma.StudentInclude;

type StudentWithRelations = Prisma.StudentGetPayload<{ include: typeof rowInclude }>;

// Фамилия «Кузнецов»/«Кузнецев» — одна опечатка; при более длинной фамилии
// допускаем две. Больше — уже другой человек.
function allowedDistance(length: number): number {
  return length >= 8 ? 2 : 1;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toRow(student: StudentWithRelations): StudentRow {
    return {
      id: student.id,
      lastName: student.lastName,
      firstName: student.firstName,
      fullName: `${student.lastName} ${student.firstName}`,
      origin: student.origin,
      classId: student.classId,
      className: className(student.class.number, student.class.letter),
      birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : null,
      comment: student.comment,
      runCount: student._count.runs,
      noteCount: student._count.notes,
      lastRunAt: student.runs[0]?.completedAt?.toISOString() ?? null,
      tags: student.tags.map((t) => ({ id: t.id, label: t.label, color: t.color })),
      possibleDuplicateOf: student.possibleDuplicateOf
        ? {
            id: student.possibleDuplicateOf.id,
            fullName: `${student.possibleDuplicateOf.lastName} ${student.possibleDuplicateOf.firstName}`,
            origin: student.possibleDuplicateOf.origin,
          }
        : null,
      archived: Boolean(student.archivedAt),
      createdAt: student.createdAt.toISOString(),
    };
  }

  async list(query: StudentQueryDto): Promise<StudentRow[]> {
    const search = query.search?.trim();
    const students = await this.prisma.student.findMany({
      where: {
        ...(query.archived ? {} : { archivedAt: null }),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.origin ? { origin: query.origin as StudentOrigin } : {}),
        ...(query.duplicatesOnly ? { possibleDuplicateOfId: { not: null } } : {}),
        ...(search
          ? {
              OR: [
                { lastName: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: rowInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return students.map((s) => this.toRow(s));
  }

  async detail(id: string): Promise<StudentDetail> {
    const student = await this.prisma.student.findUnique({ where: { id }, include: rowInclude });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    const [runs, notes] = await Promise.all([
      this.prisma.testRun.findMany({
        where: { studentId: id },
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
        include: { test: { select: { title: true } }, class: true },
      }),
      this.prisma.note.findMany({
        where: { studentId: id },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { fullName: true } } },
      }),
    ]);

    return {
      ...this.toRow(student),
      runs: runs.map((r) => ({
        id: r.id,
        testId: r.testId,
        testTitle: r.test.title,
        className: className(r.class.number, r.class.letter),
        score: r.score,
        maxScore: r.maxScore,
        interpretationLabel: r.interpretationLabel,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        text: n.text,
        authorName: n.author.fullName,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
    };
  }

  async create(dto: CreateStudentDto): Promise<StudentRow> {
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: dto.classId } });
    if (!schoolClass) {
      throw new NotFoundException('Класс не найден');
    }
    const lastName = titleCase(dto.lastName);
    const firstName = titleCase(dto.firstName);
    const searchKey = buildSearchKey(lastName, firstName);

    const twin = await this.prisma.student.findFirst({
      where: { classId: dto.classId, searchKey, archivedAt: null },
    });
    if (twin) {
      throw new BadRequestException(
        `В классе ${className(schoolClass.number, schoolClass.letter)} уже есть ${lastName} ${firstName}`,
      );
    }

    const created = await this.prisma.student.create({
      data: {
        classId: dto.classId,
        lastName,
        firstName,
        searchKey,
        origin: StudentOrigin.TRACKED,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        comment: dto.comment?.trim() ?? '',
      },
      include: rowInclude,
    });
    return this.toRow(created);
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentRow> {
    const student = await this.requireStudent(id);
    const lastName = dto.lastName ? titleCase(dto.lastName) : student.lastName;
    const firstName = dto.firstName ? titleCase(dto.firstName) : student.firstName;

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        lastName,
        firstName,
        searchKey: buildSearchKey(lastName, firstName),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(dto.birthDate) : null } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment.trim() } : {}),
      },
      include: rowInclude,
    });
    return this.toRow(updated);
  }

  private async requireStudent(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    return student;
  }

  /** Перевод одного ученика в другой класс. История прохождений не меняется. */
  async transfer(id: string, classId: string): Promise<StudentRow> {
    const student = await this.requireStudent(id);
    if (student.classId === classId) {
      throw new BadRequestException('Ученик уже в этом классе');
    }
    const target = await this.prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!target || target.archivedAt) {
      throw new NotFoundException('Класс не найден или отправлен в архив');
    }
    const twin = await this.prisma.student.findFirst({
      where: { classId, searchKey: student.searchKey, archivedAt: null },
    });
    if (twin) {
      throw new BadRequestException(
        `В классе ${className(target.number, target.letter)} уже есть ${student.lastName} ${student.firstName}`,
      );
    }
    const updated = await this.prisma.student.update({
      where: { id },
      data: { classId, possibleDuplicateOfId: null },
      include: rowInclude,
    });
    return this.toRow(updated);
  }

  /** Перевод между категориями: «на карандаше» ↔ появившийся автоматически. */
  async setOrigin(id: string, origin: StudentOrigin): Promise<StudentRow> {
    await this.requireStudent(id);
    const updated = await this.prisma.student.update({
      where: { id },
      data: { origin, ...(origin === StudentOrigin.TRACKED ? { possibleDuplicateOfId: null } : {}) },
      include: rowInclude,
    });
    return this.toRow(updated);
  }

  /**
   * Слияние дублей: прохождения, заметки и метки уезжают к целевому ученику,
   * исходная карточка удаляется. Направление выбирает психолог.
   */
  async merge(targetId: string, sourceId: string): Promise<StudentDetail> {
    if (targetId === sourceId) {
      throw new BadRequestException('Нельзя объединить ученика с самим собой');
    }
    const [target, source] = await Promise.all([
      this.requireStudent(targetId),
      this.requireStudent(sourceId),
    ]);

    const existingTags = await this.prisma.studentTag.findMany({
      where: { studentId: targetId },
      select: { label: true },
    });
    const taken = new Set(existingTags.map((t) => t.label));

    await this.prisma.$transaction([
      this.prisma.testRun.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } }),
      this.prisma.note.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } }),
      this.prisma.studentTag.deleteMany({ where: { studentId: sourceId, label: { in: [...taken] } } }),
      this.prisma.studentTag.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } }),
      this.prisma.student.updateMany({
        where: { possibleDuplicateOfId: sourceId },
        data: { possibleDuplicateOfId: targetId },
      }),
      this.prisma.student.update({
        where: { id: targetId },
        data: {
          possibleDuplicateOfId: null,
          // Комментарии обеих карточек лучше склеить, чем потерять.
          comment: [target.comment, source.comment].filter(Boolean).join('\n\n'),
        },
      }),
      this.prisma.student.delete({ where: { id: sourceId } }),
    ]);

    return this.detail(targetId);
  }

  /** «Это разные люди» — снимаем отметку о возможном дубле. */
  async dismissDuplicate(id: string): Promise<StudentRow> {
    await this.requireStudent(id);
    const updated = await this.prisma.student.update({
      where: { id },
      data: { possibleDuplicateOfId: null },
      include: rowInclude,
    });
    return this.toRow(updated);
  }

  async archive(id: string): Promise<{ ok: true }> {
    await this.requireStudent(id);
    await this.prisma.student.update({ where: { id }, data: { archivedAt: new Date() } });
    return { ok: true };
  }

  async restore(id: string): Promise<StudentRow> {
    await this.requireStudent(id);
    const updated = await this.prisma.student.update({
      where: { id },
      data: { archivedAt: null },
      include: rowInclude,
    });
    return this.toRow(updated);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.requireStudent(id);
    const runs = await this.prisma.testRun.count({ where: { studentId: id } });
    if (runs > 0) {
      throw new BadRequestException(
        'У ученика есть результаты тестирований — карточку можно только отправить в архив',
      );
    }
    await this.prisma.student.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Заметки ─────────────────────────────────────────────────────────────

  async addNote(studentId: string, authorId: string, dto: NoteDto) {
    await this.requireStudent(studentId);
    const note = await this.prisma.note.create({
      data: { studentId, authorId, text: dto.text.trim() },
      include: { author: { select: { fullName: true } } },
    });
    return {
      id: note.id,
      text: note.text,
      authorName: note.author.fullName,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  async updateNote(noteId: string, dto: NoteDto) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Заметка не найдена');
    }
    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: { text: dto.text.trim() },
      include: { author: { select: { fullName: true } } },
    });
    return {
      id: updated.id,
      text: updated.text,
      authorName: updated.author.fullName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async removeNote(noteId: string): Promise<{ ok: true }> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Заметка не найдена');
    }
    await this.prisma.note.delete({ where: { id: noteId } });
    return { ok: true };
  }

  // ─── Метки ───────────────────────────────────────────────────────────────

  async addTag(studentId: string, createdById: string, dto: TagDto) {
    await this.requireStudent(studentId);
    const label = dto.label.trim();
    const existing = await this.prisma.studentTag.findUnique({
      where: { studentId_label: { studentId, label } },
    });
    if (existing) {
      throw new BadRequestException('Такая метка уже стоит');
    }
    const tag = await this.prisma.studentTag.create({
      data: { studentId, createdById, label, color: dto.color ?? 'warning' },
    });
    return { id: tag.id, label: tag.label, color: tag.color };
  }

  async removeTag(tagId: string): Promise<{ ok: true }> {
    const tag = await this.prisma.studentTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Метка не найдена');
    }
    await this.prisma.studentTag.delete({ where: { id: tagId } });
    return { ok: true };
  }

  // ─── Сопоставление при прохождении теста ─────────────────────────────────

  /**
   * Ученик подписался на бумаге «Иванов Иван» и прошёл тест по коду класса 8Б.
   * Точное совпадение ФИО в этом классе — считаем, что это он же. Похожее
   * (опечатка) — заводим новую карточку и вешаем отметку «возможный дубль»,
   * решение остаётся за психологом.
   */
  async resolveForRun(
    tx: Prisma.TransactionClient,
    classId: string,
    rawLastName: string,
    rawFirstName: string,
  ): Promise<{ id: string; matched: boolean }> {
    const lastName = titleCase(rawLastName);
    const firstName = titleCase(rawFirstName);
    const searchKey = buildSearchKey(lastName, firstName);

    const exact = await tx.student.findFirst({
      where: { classId, searchKey, archivedAt: null },
    });
    if (exact) {
      return { id: exact.id, matched: true };
    }

    const candidates = await tx.student.findMany({
      where: { classId, archivedAt: null },
      select: { id: true, lastName: true, firstName: true },
    });

    const last = normalizeName(lastName);
    const first = normalizeName(firstName);
    let nearest: { id: string; distance: number } | null = null;

    for (const candidate of candidates) {
      const candidateLast = normalizeName(candidate.lastName);
      const candidateFirst = normalizeName(candidate.firstName);
      const lastDistance = levenshtein(last, candidateLast);
      const firstDistance = levenshtein(first, candidateFirst);
      if (lastDistance > allowedDistance(Math.max(last.length, candidateLast.length))) {
        continue;
      }
      if (firstDistance > allowedDistance(Math.max(first.length, candidateFirst.length))) {
        continue;
      }
      const total = lastDistance + firstDistance;
      if (!nearest || total < nearest.distance) {
        nearest = { id: candidate.id, distance: total };
      }
    }

    const created = await tx.student.create({
      data: {
        classId,
        lastName,
        firstName,
        searchKey,
        origin: StudentOrigin.AUTO,
        possibleDuplicateOfId: nearest?.id ?? null,
      },
    });
    return { id: created.id, matched: false };
  }
}
