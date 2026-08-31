import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { className } from '../common/text';
import { CreateClassDto, UpdateClassDto } from './dto/classes.dto';

export interface ClassRow {
  id: string;
  number: number;
  letter: string;
  name: string;
  plannedSize: number;
  homeroomTeacher: string;
  trackedCount: number;
  autoCount: number;
  studentCount: number;
  completedRuns: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeArchived = false): Promise<ClassRow[]> {
    const classes = await this.prisma.schoolClass.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ archivedAt: 'asc' }, { number: 'asc' }, { letter: 'asc' }],
      include: {
        students: { where: { archivedAt: null }, select: { origin: true } },
        _count: { select: { runs: true } },
      },
    });

    return classes.map((c) => {
      const tracked = c.students.filter((s) => s.origin === StudentOrigin.TRACKED).length;
      return {
        id: c.id,
        number: c.number,
        letter: c.letter,
        name: className(c.number, c.letter),
        plannedSize: c.plannedSize,
        homeroomTeacher: c.homeroomTeacher,
        trackedCount: tracked,
        autoCount: c.students.length - tracked,
        studentCount: c.students.length,
        completedRuns: c._count.runs,
        archived: Boolean(c.archivedAt),
        archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  async one(id: string): Promise<ClassRow> {
    const rows = await this.list(true);
    const row = rows.find((r) => r.id === id);
    if (!row) {
      throw new NotFoundException('Класс не найден');
    }
    return row;
  }

  private async requireClass(id: string) {
    const record = await this.prisma.schoolClass.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Класс не найден');
    }
    return record;
  }

  private findActive(number: number, letter: string) {
    return this.prisma.schoolClass.findUnique({
      where: { number_letter_archiveKey: { number, letter, archiveKey: '' } },
    });
  }

  async create(dto: CreateClassDto): Promise<ClassRow> {
    if (await this.findActive(dto.number, dto.letter)) {
      throw new BadRequestException(`Класс ${className(dto.number, dto.letter)} уже создан`);
    }
    const created = await this.prisma.schoolClass.create({
      data: {
        number: dto.number,
        letter: dto.letter,
        plannedSize: dto.plannedSize,
        homeroomTeacher: dto.homeroomTeacher?.trim() ?? '',
      },
    });
    return this.one(created.id);
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassRow> {
    await this.requireClass(id);
    await this.prisma.schoolClass.update({
      where: { id },
      data: {
        ...(dto.plannedSize !== undefined ? { plannedSize: dto.plannedSize } : {}),
        ...(dto.homeroomTeacher !== undefined ? { homeroomTeacher: dto.homeroomTeacher.trim() } : {}),
      },
    });
    return this.one(id);
  }

  /**
   * Перевод класса (7Б → 8Б).
   *
   * Если по классу уже есть прохождения, менять его табличку нельзя: результаты
   * ссылаются на запись класса, и переименование задним числом превратило бы
   * прошлогодний срез 7Б в срез 8Б. Поэтому заводим отдельную запись под новый
   * учебный год и переносим в неё учеников, а прежнюю отправляем в архив —
   * история остаётся при своём классе.
   *
   * Класс без прохождений — это ещё не история, а опечатка при создании,
   * такой просто переименовывается на месте.
   */
  async transfer(id: string, number: number, letter: string): Promise<ClassRow> {
    const source = await this.requireClass(id);
    if (source.archivedAt) {
      throw new BadRequestException('Класс в архиве — сначала восстановите его');
    }
    if (source.number === number && source.letter === letter) {
      throw new BadRequestException('Класс уже так называется');
    }

    let target = await this.findActive(number, letter);

    if (!target) {
      const runs = await this.prisma.testRun.count({ where: { classId: id } });
      if (runs === 0) {
        await this.prisma.schoolClass.update({ where: { id }, data: { number, letter } });
        return this.one(id);
      }
      target = await this.prisma.schoolClass.create({
        data: {
          number,
          letter,
          plannedSize: source.plannedSize,
          homeroomTeacher: source.homeroomTeacher,
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.student.updateMany({ where: { classId: id }, data: { classId: target.id } }),
      this.prisma.invite.updateMany({
        where: { classId: id, status: 'ISSUED' },
        data: { classId: target.id },
      }),
      this.prisma.schoolClass.update({
        where: { id: target.id },
        data: {
          plannedSize: Math.max(target.plannedSize, source.plannedSize),
          homeroomTeacher: target.homeroomTeacher || source.homeroomTeacher,
        },
      }),
      this.prisma.schoolClass.update({
        where: { id },
        data: { archivedAt: new Date(), archiveKey: `${Date.now()}-${id.slice(0, 6)}` },
      }),
    ]);

    return this.one(target.id);
  }

  /**
   * Перевод школы на следующий учебный год: одиннадцатые выпускаются
   * (класс и его ученики уходят в архив), остальные поднимаются на параллель
   * выше. Идём от старших к младшим, чтобы место наверху успело освободиться.
   */
  async promoteYear(): Promise<{ promoted: number; graduated: number }> {
    const classes = await this.prisma.schoolClass.findMany({
      where: { archivedAt: null },
      orderBy: [{ number: 'desc' }, { letter: 'asc' }],
    });

    let promoted = 0;
    let graduated = 0;
    const now = new Date();

    for (const cls of classes) {
      if (cls.number >= 11) {
        await this.prisma.$transaction([
          this.prisma.student.updateMany({
            where: { classId: cls.id, archivedAt: null },
            data: { archivedAt: now },
          }),
          this.prisma.invite.updateMany({
            where: { classId: cls.id, status: 'ISSUED' },
            data: { status: 'REVOKED' },
          }),
          this.prisma.schoolClass.update({
            where: { id: cls.id },
            data: { archivedAt: now, archiveKey: `${now.getTime()}-${cls.id.slice(0, 6)}` },
          }),
        ]);
        graduated += 1;
        continue;
      }
      await this.transfer(cls.id, cls.number + 1, cls.letter);
      promoted += 1;
    }

    return { promoted, graduated };
  }

  async archive(id: string): Promise<{ ok: true }> {
    const record = await this.requireClass(id);
    if (record.archivedAt) {
      return { ok: true };
    }
    await this.prisma.schoolClass.update({
      where: { id },
      data: { archivedAt: new Date(), archiveKey: `${Date.now()}-${id.slice(0, 6)}` },
    });
    return { ok: true };
  }

  async restore(id: string): Promise<ClassRow> {
    const record = await this.requireClass(id);
    if (!record.archivedAt) {
      return this.one(id);
    }
    if (await this.findActive(record.number, record.letter)) {
      throw new BadRequestException(
        `Класс ${className(record.number, record.letter)} уже существует — сначала переведите или переименуйте его`,
      );
    }
    await this.prisma.schoolClass.update({
      where: { id },
      data: { archivedAt: null, archiveKey: '' },
    });
    return this.one(id);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const record = await this.requireClass(id);
    const runs = await this.prisma.testRun.count({ where: { classId: id } });
    if (runs > 0) {
      throw new BadRequestException(
        'В классе есть результаты тестирований — его можно только отправить в архив',
      );
    }
    await this.prisma.schoolClass.delete({ where: { id: record.id } });
    return { ok: true };
  }
}
