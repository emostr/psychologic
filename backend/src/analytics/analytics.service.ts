import { Injectable, NotFoundException } from '@nestjs/common';
import { InviteStatus, StudentOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { className } from '../common/text';

export interface LevelSlice {
  label: string;
  color: string;
  count: number;
  percent: number;
}

export interface ScopeStats {
  key: string;
  label: string;
  runs: number;
  students: number;
  avgScore: number | null;
  avgPercent: number | null;
  minScore: number | null;
  maxScore: number | null;
  levels: LevelSlice[];
}

export interface TestReport {
  test: {
    id: string;
    title: string;
    maxScore: number;
    interpretations: { label: string; color: string; minScore: number; maxScore: number }[];
  };
  school: ScopeStats;
  parallels: ScopeStats[];
  classes: ScopeStats[];
  timeline: { period: string; runs: number; avgPercent: number | null }[];
}

export interface OverviewTiles {
  classes: number;
  students: number;
  trackedStudents: number;
  tests: number;
  publishedTests: number;
  runs: number;
  runsLast30: number;
  activeCodes: number;
  duplicates: number;
}

export interface CoverageRow {
  classId: string;
  className: string;
  plannedSize: number;
  knownStudents: number;
  testedStudents: number;
  coveragePercent: number;
}

export interface AttentionRow {
  studentId: string;
  studentName: string;
  className: string;
  reasons: string[];
  tags: { label: string; color: string }[];
  lastRunAt: string | null;
}

export interface Overview {
  tiles: OverviewTiles;
  coverage: CoverageRow[];
  activity: { date: string; runs: number }[];
  attention: AttentionRow[];
  recent: {
    id: string;
    studentName: string;
    className: string;
    testTitle: string;
    score: number | null;
    interpretationLabel: string | null;
    color: string;
    completedAt: string;
  }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<Overview> {
    const since30 = new Date(Date.now() - 30 * DAY_MS);

    const [classes, students, trackedStudents, tests, publishedTests, runs, runsLast30, activeCodes, duplicates] =
      await Promise.all([
        this.prisma.schoolClass.count({ where: { archivedAt: null } }),
        this.prisma.student.count({ where: { archivedAt: null } }),
        this.prisma.student.count({ where: { archivedAt: null, origin: StudentOrigin.TRACKED } }),
        this.prisma.test.count({ where: { deletedAt: null } }),
        this.prisma.test.count({ where: { deletedAt: null, isPublished: true } }),
        this.prisma.testRun.count({ where: { completedAt: { not: null } } }),
        this.prisma.testRun.count({ where: { completedAt: { gte: since30 } } }),
        this.prisma.invite.count({ where: { status: InviteStatus.ISSUED, campaign: { closedAt: null } } }),
        this.prisma.student.count({ where: { archivedAt: null, possibleDuplicateOfId: { not: null } } }),
      ]);

    const [classRows, testedRows, activityRows, recentRuns] = await Promise.all([
      this.prisma.schoolClass.findMany({
        where: { archivedAt: null },
        orderBy: [{ number: 'asc' }, { letter: 'asc' }],
        include: { _count: { select: { students: true } } },
      }),
      this.prisma.testRun.findMany({
        where: { completedAt: { not: null } },
        select: { classId: true, studentId: true },
        distinct: ['classId', 'studentId'],
      }),
      this.prisma.testRun.findMany({
        where: { completedAt: { gte: since30 } },
        select: { completedAt: true },
      }),
      this.prisma.testRun.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 12,
        include: {
          test: { select: { title: true, interpretations: true } },
          student: { select: { lastName: true, firstName: true } },
          class: true,
        },
      }),
    ]);

    const testedByClass = new Map<string, number>();
    for (const row of testedRows) {
      testedByClass.set(row.classId, (testedByClass.get(row.classId) ?? 0) + 1);
    }

    const coverage: CoverageRow[] = classRows.map((c) => {
      const tested = testedByClass.get(c.id) ?? 0;
      // Знаменатель — плановая численность: она честнее, чем число заведённых
      // карточек, ведь автоучеников появляется ровно столько, сколько прошло.
      const denominator = c.plannedSize || c._count.students || 0;
      return {
        classId: c.id,
        className: className(c.number, c.letter),
        plannedSize: c.plannedSize,
        knownStudents: c._count.students,
        testedStudents: tested,
        coveragePercent: denominator ? Math.min(100, Math.round((tested / denominator) * 100)) : 0,
      };
    });

    const activityMap = new Map<string, number>();
    for (let i = 29; i >= 0; i -= 1) {
      activityMap.set(isoDate(new Date(Date.now() - i * DAY_MS)), 0);
    }
    for (const row of activityRows) {
      if (!row.completedAt) {
        continue;
      }
      const key = isoDate(row.completedAt);
      if (activityMap.has(key)) {
        activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
      }
    }

    return {
      tiles: {
        classes,
        students,
        trackedStudents,
        tests,
        publishedTests,
        runs,
        runsLast30,
        activeCodes,
        duplicates,
      },
      coverage,
      activity: [...activityMap.entries()].map(([date, count]) => ({ date, runs: count })),
      attention: await this.attention(),
      recent: recentRuns.map((r) => ({
        id: r.id,
        studentName: `${r.student.lastName} ${r.student.firstName}`,
        className: className(r.class.number, r.class.letter),
        testTitle: r.test.title,
        score: r.score,
        interpretationLabel: r.interpretationLabel,
        color:
          r.test.interpretations.find((i) => i.label === r.interpretationLabel)?.color ?? 'neutral',
        completedAt: r.completedAt!.toISOString(),
      })),
    };
  }

  /**
   * На кого посмотреть в первую очередь: помеченные вручную и те, у кого
   * последний результат попал в «красную» зону интерпретации.
   */
  async attention(): Promise<AttentionRow[]> {
    const [tagged, redRuns] = await Promise.all([
      this.prisma.student.findMany({
        where: { archivedAt: null, tags: { some: {} } },
        include: { class: true, tags: true },
      }),
      this.prisma.testRun.findMany({
        where: { completedAt: { not: null }, interpretationLabel: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 400,
        include: {
          test: { select: { title: true, interpretations: true } },
          student: { include: { class: true, tags: true } },
        },
      }),
    ]);

    const rows = new Map<string, AttentionRow>();

    const ensure = (
      studentId: string,
      studentName: string,
      classLabel: string,
      tags: { label: string; color: string }[],
    ): AttentionRow => {
      const existing = rows.get(studentId);
      if (existing) {
        return existing;
      }
      const created: AttentionRow = {
        studentId,
        studentName,
        className: classLabel,
        reasons: [],
        tags,
        lastRunAt: null,
      };
      rows.set(studentId, created);
      return created;
    };

    for (const student of tagged) {
      const row = ensure(
        student.id,
        `${student.lastName} ${student.firstName}`,
        className(student.class.number, student.class.letter),
        student.tags.map((t) => ({ label: t.label, color: t.color })),
      );
      row.reasons.push('Стоит на контроле');
    }

    const seenLatest = new Set<string>();
    for (const run of redRuns) {
      if (run.student.archivedAt) {
        continue;
      }
      // Берём только самый свежий результат ученика — старые «красные» уже
      // могли смениться нормальными.
      const seenKey = `${run.studentId}:${run.testId}`;
      if (seenLatest.has(seenKey)) {
        continue;
      }
      seenLatest.add(seenKey);

      const level = run.test.interpretations.find((i) => i.label === run.interpretationLabel);
      if (level?.color !== 'danger') {
        continue;
      }
      const row = ensure(
        run.studentId,
        `${run.student.lastName} ${run.student.firstName}`,
        className(run.student.class.number, run.student.class.letter),
        run.student.tags.map((t) => ({ label: t.label, color: t.color })),
      );
      row.reasons.push(`${run.test.title}: ${run.interpretationLabel}`);
      const completed = run.completedAt!.toISOString();
      if (!row.lastRunAt || completed > row.lastRunAt) {
        row.lastRunAt = completed;
      }
    }

    return [...rows.values()].sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 50);
  }

  /** Полный отчёт по одной методике: школа, параллели, классы и динамика. */
  async testReport(testId: string): Promise<TestReport> {
    const test = await this.prisma.test.findFirst({
      where: { id: testId },
      include: { interpretations: { orderBy: { minScore: 'asc' } } },
    });
    if (!test) {
      throw new NotFoundException('Тест не найден');
    }

    const runs = await this.prisma.testRun.findMany({
      where: { testId, completedAt: { not: null }, score: { not: null } },
      include: { class: true, student: { select: { id: true } } },
      orderBy: { completedAt: 'asc' },
    });

    const levels = test.interpretations.map((i) => ({ label: i.label, color: i.color }));

    const build = (
      key: string,
      label: string,
      subset: typeof runs,
    ): ScopeStats => {
      const scores = subset.map((r) => r.score!).filter((s) => Number.isFinite(s));
      const percents = subset
        .filter((r) => r.maxScore)
        .map((r) => (r.score! / r.maxScore!) * 100);
      const counts = new Map(levels.map((l) => [l.label, 0]));
      for (const run of subset) {
        if (run.interpretationLabel && counts.has(run.interpretationLabel)) {
          counts.set(run.interpretationLabel, (counts.get(run.interpretationLabel) ?? 0) + 1);
        }
      }
      const total = subset.length || 1;
      return {
        key,
        label,
        runs: subset.length,
        students: new Set(subset.map((r) => r.student.id)).size,
        avgScore: average(scores),
        avgPercent: average(percents),
        minScore: scores.length ? Math.min(...scores) : null,
        maxScore: scores.length ? Math.max(...scores) : null,
        levels: levels.map((l) => ({
          label: l.label,
          color: l.color,
          count: counts.get(l.label) ?? 0,
          percent: Math.round(((counts.get(l.label) ?? 0) / total) * 100),
        })),
      };
    };

    const byParallel = new Map<number, typeof runs>();
    const byClass = new Map<string, typeof runs>();
    for (const run of runs) {
      const parallel = run.class.number;
      byParallel.set(parallel, [...(byParallel.get(parallel) ?? []), run]);
      byClass.set(run.classId, [...(byClass.get(run.classId) ?? []), run]);
    }

    const parallels = [...byParallel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, subset]) => build(String(number), `${number}-е классы`, subset));

    const classes = [...byClass.entries()]
      .map(([classId, subset]) => {
        const first = subset[0].class;
        return build(classId, className(first.number, first.letter), subset);
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ru', { numeric: true }));

    // Динамика по месяцам — видно, растёт ли тревожность от четверти к четверти.
    const byMonth = new Map<string, { runs: number; percents: number[] }>();
    for (const run of runs) {
      const period = run.completedAt!.toISOString().slice(0, 7);
      const entry = byMonth.get(period) ?? { runs: 0, percents: [] };
      entry.runs += 1;
      if (run.maxScore) {
        entry.percents.push((run.score! / run.maxScore) * 100);
      }
      byMonth.set(period, entry);
    }

    const maxScore = runs.find((r) => r.maxScore)?.maxScore ?? 0;

    return {
      test: {
        id: test.id,
        title: test.title,
        maxScore,
        interpretations: test.interpretations.map((i) => ({
          label: i.label,
          color: i.color,
          minScore: i.minScore,
          maxScore: i.maxScore,
        })),
      },
      school: build('school', 'Вся школа', runs),
      parallels,
      classes,
      timeline: [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, entry]) => ({
          period,
          runs: entry.runs,
          avgPercent: average(entry.percents),
        })),
    };
  }

  /** Разбор одного класса по методике: поимённо, с уровнями. */
  async classReport(classId: string, testId: string) {
    const [schoolClass, test] = await Promise.all([
      this.prisma.schoolClass.findUnique({ where: { id: classId } }),
      this.prisma.test.findUnique({
        where: { id: testId },
        include: { interpretations: { orderBy: { minScore: 'asc' } } },
      }),
    ]);
    if (!schoolClass || !test) {
      throw new NotFoundException('Класс или тест не найден');
    }

    const runs = await this.prisma.testRun.findMany({
      where: { classId, testId, completedAt: { not: null } },
      orderBy: { score: 'desc' },
      include: { student: { select: { id: true, lastName: true, firstName: true, origin: true } } },
    });

    return {
      className: className(schoolClass.number, schoolClass.letter),
      homeroomTeacher: schoolClass.homeroomTeacher,
      plannedSize: schoolClass.plannedSize,
      testTitle: test.title,
      rows: runs.map((r) => ({
        runId: r.id,
        studentId: r.student.id,
        studentName: `${r.student.lastName} ${r.student.firstName}`,
        origin: r.student.origin,
        score: r.score,
        maxScore: r.maxScore,
        percent: r.score !== null && r.maxScore ? Math.round((r.score / r.maxScore) * 100) : null,
        level: r.interpretationLabel,
        color: test.interpretations.find((i) => i.label === r.interpretationLabel)?.color ?? 'neutral',
        completedAt: r.completedAt!.toISOString(),
      })),
    };
  }
}
