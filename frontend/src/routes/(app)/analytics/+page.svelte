<script lang="ts">
  import { page } from '$app/state'
  import type { ChartConfiguration } from 'chart.js'
  import {
    PageHeader,
    Card,
    Select,
    Badge,
    Button,
    Chart,
    Table,
    EmptyState,
    Skeleton,
    Tabs,
    Progress,
  } from '$ui'
  import { api, errorMessage, qs } from '$lib/api'
  import { notify } from '$lib/notify'
  import { toneColor, cssVar, themeKey } from '$lib/theme.svelte'
  import { monthLabel, formatDateTime, countLabel } from '$lib/format'
  import { ORIGIN_LABELS } from '$lib/catalog'
  import type { ClassReport, ScopeStats, TestReport, TestSummary } from '$lib/types'

  let tests = $state<TestSummary[]>([])
  let testId = $state<string | number>('')
  let report = $state<TestReport | null>(null)
  let loading = $state(false)

  let scope = $state('school')
  let classReport = $state<ClassReport | null>(null)

  const testsWithRuns = $derived(tests.filter((t) => t.runCount > 0))

  const current = $derived<ScopeStats | null>(
    !report
      ? null
      : scope === 'school'
        ? report.school
        : (report.parallels.find((p) => `p${p.key}` === scope) ??
          report.classes.find((c) => c.key === scope) ??
          report.school),
  )

  const scopeOptions = $derived(
    !report
      ? []
      : [
          { value: 'school', label: 'Вся школа' },
          ...report.parallels.map((p) => ({ value: `p${p.key}`, label: p.label })),
          ...report.classes.map((c) => ({ value: c.key, label: `Класс ${c.label}` })),
        ],
  )

  $effect(() => {
    void loadTests()
  })

  $effect(() => {
    const preset = page.url.searchParams.get('testId')
    if (preset) {
      testId = preset
    }
  })

  $effect(() => {
    if (testId) {
      void loadReport(String(testId))
    }
  })

  // Поимённая расшифровка нужна, только когда выбран конкретный класс.
  $effect(() => {
    const isClass = report?.classes.some((c) => c.key === scope) ?? false
    if (isClass && testId) {
      void api
        .get<ClassReport>(`/analytics/class/${scope}` + qs({ testId }))
        .then((value) => {
          classReport = value
        })
        .catch(() => {
          classReport = null
        })
    } else {
      classReport = null
    }
  })

  async function loadTests() {
    try {
      tests = await api.get<TestSummary[]>('/tests')
      if (!testId) {
        testId = tests.find((t) => t.runCount > 0)?.id ?? ''
      }
    } catch (e) {
      notify.error('Не удалось загрузить тесты', { text: errorMessage(e) })
    }
  }

  async function loadReport(id: string) {
    loading = true
    try {
      report = await api.get<TestReport>(`/analytics/report/${id}`)
      scope = 'school'
    } catch (e) {
      notify.error('Не удалось построить отчёт', { text: errorMessage(e) })
      report = null
    } finally {
      loading = false
    }
  }

  function levelsConfig(): ChartConfiguration {
    const slices = current?.levels ?? []
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: slices.map((l) => l.label),
        datasets: [
          {
            data: slices.map((l) => l.count),
            backgroundColor: slices.map((l) => toneColor(l.color)),
            borderColor: cssVar('--ng-surface'),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 14 } },
        },
      },
    }
    return config as ChartConfiguration
  }

  function classesConfig(): ChartConfiguration {
    const classes = report?.classes ?? []
    return {
      type: 'bar',
      data: {
        labels: classes.map((c) => c.label),
        datasets: [
          {
            label: 'Средний результат, %',
            data: classes.map((c) => c.avgPercent ?? 0),
            backgroundColor: cssVar('--ng-accent'),
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, max: 100, grid: { color: cssVar('--ng-line') } },
        },
      },
    }
  }

  function stackedConfig(): ChartConfiguration {
    const classes = report?.classes ?? []
    const levels = report?.test.interpretations ?? []
    return {
      type: 'bar',
      data: {
        labels: classes.map((c) => c.label),
        datasets: levels.map((level) => ({
          label: level.label,
          data: classes.map((c) => c.levels.find((l) => l.label === level.label)?.count ?? 0),
          backgroundColor: toneColor(level.color),
          maxBarThickness: 34,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 12 } } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--ng-line') } },
        },
      },
    }
  }

  function parallelsConfig(): ChartConfiguration {
    const parallels = report?.parallels ?? []
    return {
      type: 'bar',
      data: {
        labels: parallels.map((p) => p.label),
        datasets: [
          {
            label: 'Средний результат, %',
            data: parallels.map((p) => p.avgPercent ?? 0),
            backgroundColor: cssVar('--ng-info'),
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: cssVar('--ng-line') } },
          y: { grid: { display: false } },
        },
      },
    }
  }

  function timelineConfig(): ChartConfiguration {
    const timeline = report?.timeline ?? []
    return {
      type: 'line',
      data: {
        labels: timeline.map((t) => monthLabel(t.period)),
        datasets: [
          {
            label: 'Средний результат, %',
            data: timeline.map((t) => t.avgPercent ?? 0),
            borderColor: cssVar('--ng-accent'),
            backgroundColor: `${cssVar('--ng-accent')}22`,
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Прохождений',
            data: timeline.map((t) => t.runs),
            borderColor: cssVar('--ng-muted'),
            borderDash: [4, 4],
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 12 } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, max: 100, grid: { color: cssVar('--ng-line') } },
          y1: {
            beginAtZero: true,
            position: 'right',
            ticks: { precision: 0 },
            grid: { display: false },
          },
        },
      },
    }
  }

  // Графики перечитывают палитру при смене темы.
  const revision = $derived(themeKey())
</script>

<svelte:head><title>Аналитика · Психолоджик</title></svelte:head>

<PageHeader title="Аналитика" subtitle="Сводка по классу, по параллели и по всей школе">
  {#snippet actions()}
    <Select
      bind:value={testId}
      placeholder="Выберите методику"
      options={tests.map((t) => ({
        value: t.id,
        label: t.runCount ? `${t.title} · ${t.runCount}` : `${t.title} · нет данных`,
        disabled: t.runCount === 0,
      }))}
      class="w-full sm:w-80"
    />
  {/snippet}
</PageHeader>

{#if !testsWithRuns.length && !loading}
  <Card padding={false}>
    <EmptyState
      icon="barChart"
      title="Считать пока нечего"
      description="Аналитика появится, как только по какой-нибудь методике будут первые прохождения."
    >
      {#snippet actions()}
        <Button icon="qr" href="/campaigns">Выдать тест классам</Button>
      {/snippet}
    </EmptyState>
  </Card>
{:else if loading || !report}
  <div class="bg-surface border border-line p-6"><Skeleton rows={6} /></div>
{:else if current}
  {#key revision}
    <Tabs
      bind:value={scope}
      tabs={scopeOptions.map((o) => ({ value: String(o.value), label: o.label }))}
      class="mb-6"
    />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-accent text-on-accent border border-transparent p-5">
        <div class="ng-label text-on-accent/80">Прохождений</div>
        <div class="text-3xl font-extrabold mt-2 tabular-nums">{current.runs}</div>
        <div class="text-xs text-on-accent/70 mt-1">
          {countLabel(current.students, 'ученик', 'ученика', 'учеников')}
        </div>
      </div>
      <div class="bg-surface border border-line p-5">
        <div class="ng-label text-muted">Средний балл</div>
        <div class="text-3xl font-extrabold text-ink mt-2 tabular-nums">{current.avgScore ?? '—'}</div>
        <div class="text-xs text-faint mt-1">максимум {report.test.maxScore}</div>
      </div>
      <div class="bg-surface border border-line p-5">
        <div class="ng-label text-muted">Средняя доля</div>
        <div class="text-3xl font-extrabold text-ink mt-2 tabular-nums">
          {current.avgPercent !== null ? `${current.avgPercent}%` : '—'}
        </div>
        <div class="text-xs text-faint mt-1">от максимума</div>
      </div>
      <div class="bg-surface border border-line p-5">
        <div class="ng-label text-muted">Разброс</div>
        <div class="text-3xl font-extrabold text-ink mt-2 tabular-nums">
          {current.minScore ?? '—'}–{current.maxScore ?? '—'}
        </div>
        <div class="text-xs text-faint mt-1">мин. и макс. балл</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card title="Распределение уровней" subtitle={current.label}>
        {#if current.runs}
          <Chart config={levelsConfig} height={280} />
        {:else}
          <EmptyState icon="pieChart" title="Нет данных" />
        {/if}
      </Card>

      <Card title="Уровни по классам" subtitle="Сколько учеников в каждой зоне" class="xl:col-span-2">
        {#if report.classes.length}
          <Chart config={stackedConfig} height={280} />
        {:else}
          <EmptyState icon="barChart" title="Нет данных по классам" />
        {/if}
      </Card>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      <Card title="Средний результат по классам">
        {#if report.classes.length}
          <Chart config={classesConfig} height={280} />
        {:else}
          <EmptyState icon="barChart" title="Нет данных" />
        {/if}
      </Card>

      <Card title="Средний результат по параллелям">
        {#if report.parallels.length}
          <Chart config={parallelsConfig} height={280} />
        {:else}
          <EmptyState icon="layers" title="Нет данных" />
        {/if}
      </Card>
    </div>

    {#if report.timeline.length > 1}
      <div class="mt-6">
        <Card title="Динамика" subtitle="Как меняется картина от месяца к месяцу">
          <Chart config={timelineConfig} height={280} />
        </Card>
      </div>
    {/if}

    <div class="mt-6">
      <Card title="Уровни словами" subtitle="Что делать с каждым диапазоном" padding={false}>
        <Table
          columns={[
            { key: 'level', label: 'Уровень', width: '180px' },
            { key: 'range', label: 'Баллы', align: 'center', width: '110px' },
            { key: 'count', label: 'Учеников', align: 'center', width: '110px' },
            { key: 'share', label: 'Доля' },
          ]}
          rows={current.levels}
          class="border-0"
        >
          {#snippet row(item)}
            <td class="px-4 py-3 align-middle"><Badge variant={item.color}>{item.label}</Badge></td>
            <td class="px-4 py-3 align-middle text-center text-xs text-muted tabular-nums">
              {report?.test.interpretations.find((i) => i.label === item.label)?.minScore ?? '—'}–{report?.test.interpretations.find(
                (i) => i.label === item.label,
              )?.maxScore ?? '—'}
            </td>
            <td class="px-4 py-3 align-middle text-center font-bold text-ink tabular-nums">{item.count}</td>
            <td class="px-4 py-3 align-middle">
              <Progress value={item.percent} variant={item.color} showValue />
            </td>
          {/snippet}
        </Table>
      </Card>
    </div>

    {#if classReport}
      <div class="mt-6">
        <Card
          title="Класс {classReport.className} поимённо"
          subtitle="{classReport.rows.length} из {classReport.plannedSize} по списку{classReport.homeroomTeacher
            ? ` · ${classReport.homeroomTeacher}`
            : ''}"
          padding={false}
        >
          <Table
            columns={[
              { key: 'student', label: 'Ученик' },
              { key: 'origin', label: 'Категория', width: '150px', hideOnMobile: true },
              { key: 'score', label: 'Балл', align: 'center', width: '110px' },
              { key: 'level', label: 'Уровень', width: '170px' },
              { key: 'date', label: 'Когда', width: '160px', hideOnMobile: true },
            ]}
            rows={classReport.rows}
            class="border-0"
          >
            {#snippet row(item)}
              <td class="px-4 py-3 align-middle">
                <a
                  href="/students?student={item.studentId}"
                  class="font-semibold text-ink hover:text-accent transition-colors"
                >
                  {item.studentName}
                </a>
              </td>
              <td class="px-4 py-3 align-middle hidden md:table-cell">
                <Badge variant={item.origin === 'TRACKED' ? 'accent' : 'neutral'}>
                  {ORIGIN_LABELS[item.origin]}
                </Badge>
              </td>
              <td class="px-4 py-3 align-middle text-center tabular-nums">
                <span class="font-bold text-ink">{item.score ?? '—'}</span>
                {#if item.percent !== null}<span class="text-faint text-xs"> · {item.percent}%</span>{/if}
              </td>
              <td class="px-4 py-3 align-middle">
                {#if item.level}<Badge variant={item.color}>{item.level}</Badge>{:else}
                  <span class="text-xs text-faint">—</span>
                {/if}
              </td>
              <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
                {formatDateTime(item.completedAt)}
              </td>
            {/snippet}
          </Table>
        </Card>
      </div>
    {/if}
  {/key}
{/if}
