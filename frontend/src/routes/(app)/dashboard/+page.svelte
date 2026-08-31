<script lang="ts">
  import type { ChartConfiguration } from 'chart.js'
  import { PageHeader, Tile, Card, Table, Badge, Progress, EmptyState, Chart, Button, Skeleton } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { cssVar } from '$lib/theme.svelte'
  import { auth } from '$lib/auth.svelte'
  import { formatRelative, dayLabel, countLabel } from '$lib/format'
  import type { Overview } from '$lib/types'

  let data = $state<Overview | null>(null)
  let loading = $state(true)

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    try {
      data = await api.get<Overview>('/analytics/overview')
    } catch (e) {
      notify.error('Не удалось загрузить сводку', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  const firstName = $derived(auth.profile?.fullName.split(' ').slice(1).join(' ') || auth.profile?.fullName || '')

  const coverageSorted = $derived([...(data?.coverage ?? [])].sort((a, b) => a.coveragePercent - b.coveragePercent))

  function activityConfig(): ChartConfiguration {
    const points = data?.activity ?? []
    return {
      type: 'line',
      data: {
        labels: points.map((p) => dayLabel(p.date)),
        datasets: [
          {
            label: 'Прохождений',
            data: points.map((p) => p.runs),
            borderColor: cssVar('--ng-accent'),
            backgroundColor: `${cssVar('--ng-accent')}22`,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--ng-line') } },
        },
      },
    }
  }
</script>

<svelte:head><title>Обзор · Психолоджик</title></svelte:head>

<PageHeader title="Обзор" subtitle="Здравствуйте, {firstName}. Вот что происходит в школе.">
  {#snippet actions()}
    <Button variant="secondary" icon="refresh" onclick={load} loading={loading}>Обновить</Button>
    <Button href="/campaigns" icon="qr">Выдать тест классам</Button>
  {/snippet}
</PageHeader>

{#if loading && !data}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {#each Array(4) as _, i (i)}
      <div class="border border-line bg-surface p-5 min-h-[128px]"><Skeleton rows={2} /></div>
    {/each}
  </div>
{:else if data}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <Tile
      solid
      label="Пройдено тестов"
      value={data.tiles.runs}
      icon="clipboardCheck"
      hint="{data.tiles.runsLast30} за последние 30 дней"
    />
    <Tile
      label="Учеников в базе"
      value={data.tiles.students}
      icon="users"
      hint="{data.tiles.trackedStudents} на карандаше"
      href="/students"
    />
    <Tile
      label="Классов"
      value={data.tiles.classes}
      icon="grid"
      hint={countLabel(data.tiles.tests, 'методика', 'методики', 'методик')}
      href="/classes"
    />
    <Tile
      label="Кодов на руках"
      value={data.tiles.activeCodes}
      icon="qr"
      hint="выдано и ещё не использовано"
      href="/campaigns"
    />
  </div>

  {#if data.tiles.duplicates > 0}
    <div class="mt-4 border border-line border-l-[3px] border-l-warning bg-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-ink">
        <span class="font-bold">{data.tiles.duplicates}</span>
        {countLabel(data.tiles.duplicates, 'ученик похож', 'ученика похожи', 'учеников похожи')} на уже
        заведённых — стоит проверить и объединить карточки.
      </p>
      <Button size="sm" variant="secondary" icon="merge" href="/students?tab=duplicates">Разобрать</Button>
    </div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
    <Card title="Активность за месяц" subtitle="Сколько тестов прошли ученики" class="xl:col-span-2">
      {#if data.activity.some((a) => a.runs > 0)}
        <Chart config={activityConfig} height={240} />
      {:else}
        <EmptyState
          icon="activity"
          title="Пока тихо"
          description="За последний месяц никто не проходил тесты. Создайте выдачу и раздайте классу QR-коды."
        >
          {#snippet actions()}
            <Button href="/campaigns" icon="qr">Выдать тест</Button>
          {/snippet}
        </EmptyState>
      {/if}
    </Card>

    <Card title="Требуют внимания" subtitle="Метки психолога и тревожные результаты" padding={false}>
      {#if data.attention.length}
        <ul class="divide-y divide-line max-h-[280px] overflow-y-auto">
          {#each data.attention.slice(0, 12) as row (row.studentId)}
            <li class="px-5 py-3">
              <div class="flex items-center justify-between gap-3">
                <a
                  href="/students?student={row.studentId}"
                  class="text-sm font-bold text-ink hover:text-accent transition-colors truncate"
                >
                  {row.studentName}
                </a>
                <Badge variant="neutral">{row.className}</Badge>
              </div>
              <p class="text-xs text-muted mt-1 line-clamp-2">{row.reasons.join(' · ')}</p>
            </li>
          {/each}
        </ul>
      {:else}
        <EmptyState
          icon="checkCircle"
          title="Тревожных сигналов нет"
          description="Здесь появятся ученики с метками и те, чьи результаты попали в красную зону."
        />
      {/if}
    </Card>
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
    <Card title="Охват классов" subtitle="Сколько учеников уже прошли хотя бы один тест">
      {#if coverageSorted.length}
        <div class="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {#each coverageSorted as row (row.classId)}
            <Progress
              label="{row.className} · {row.testedStudents} из {row.plannedSize || row.knownStudents}"
              value={row.coveragePercent}
              showValue
              variant={row.coveragePercent >= 80 ? 'success' : row.coveragePercent >= 40 ? 'warning' : 'danger'}
            />
          {/each}
        </div>
      {:else}
        <EmptyState icon="grid" title="Классы не созданы" description="Начните с раздела «Классы».">
          {#snippet actions()}
            <Button href="/classes" icon="plus">Создать класс</Button>
          {/snippet}
        </EmptyState>
      {/if}
    </Card>

    <Card title="Последние результаты" padding={false}>
      {#snippet actions()}
        <Button size="sm" variant="ghost" iconRight="arrowRight" href="/results">Все</Button>
      {/snippet}
      {#if data.recent.length}
        <Table
          columns={[
            { key: 'student', label: 'Ученик' },
            { key: 'test', label: 'Тест', hideOnMobile: true },
            { key: 'level', label: 'Уровень', align: 'right' },
          ]}
          rows={data.recent}
          class="border-0"
        >
          {#snippet row(item)}
            <td class="px-4 py-3 align-middle">
              <div class="font-semibold text-ink truncate">{item.studentName}</div>
              <div class="text-xs text-faint">{item.className} · {formatRelative(item.completedAt)}</div>
            </td>
            <td class="px-4 py-3 align-middle text-muted text-xs hidden md:table-cell">{item.testTitle}</td>
            <td class="px-4 py-3 align-middle text-right">
              {#if item.interpretationLabel}
                <Badge variant={item.color}>{item.interpretationLabel}</Badge>
              {:else}
                <span class="text-faint text-xs">{item.score ?? '—'}</span>
              {/if}
            </td>
          {/snippet}
        </Table>
      {:else}
        <EmptyState icon="fileText" title="Результатов пока нет" />
      {/if}
    </Card>
  </div>
{/if}
