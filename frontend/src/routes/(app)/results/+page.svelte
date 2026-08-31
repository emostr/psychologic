<script lang="ts">
  import { page } from '$app/state'
  import {
    PageHeader,
    Card,
    Table,
    Badge,
    Button,
    Modal,
    Select,
    Input,
    EmptyState,
    Alert,
    Skeleton,
  } from '$ui'
  import { api, errorMessage, qs } from '$lib/api'
  import { notify } from '$lib/notify'
  import { formatDateTime, downloadText, countLabel } from '$lib/format'
  import { QUESTION_TYPE_LABELS } from '$lib/catalog'
  import type { CampaignRow, ClassRow, RunDetail, RunRow, TestSummary } from '$lib/types'

  let rows = $state<RunRow[]>([])
  let classes = $state<ClassRow[]>([])
  let tests = $state<TestSummary[]>([])
  let campaigns = $state<CampaignRow[]>([])
  let loading = $state(true)

  let filters = $state({ testId: '' as string | number, classId: '' as string | number, campaignId: '' as string | number, search: '' })
  let detail = $state<RunDetail | null>(null)
  let detailOpen = $state(false)

  $effect(() => {
    const params = page.url.searchParams
    const campaignId = params.get('campaignId')
    const testId = params.get('testId')
    const classId = params.get('classId')
    const run = params.get('run')
    if (campaignId) {
      filters.campaignId = campaignId
    }
    if (testId) {
      filters.testId = testId
    }
    if (classId) {
      filters.classId = classId
    }
    if (run) {
      void openDetail(run)
    }
  })

  $effect(() => {
    void loadReferences()
  })

  $effect(() => {
    void loadRuns(filters.testId, filters.classId, filters.campaignId, filters.search)
  })

  async function loadReferences() {
    try {
      const [classRows, testRows, campaignRows] = await Promise.all([
        api.get<ClassRow[]>('/classes' + qs({ archived: true })),
        api.get<TestSummary[]>('/tests'),
        api.get<CampaignRow[]>('/campaigns'),
      ])
      classes = classRows
      tests = testRows
      campaigns = campaignRows
    } catch (e) {
      notify.error('Не удалось загрузить справочники', { text: errorMessage(e) })
    }
  }

  async function loadRuns(
    testId: string | number,
    classId: string | number,
    campaignId: string | number,
    search: string,
  ) {
    loading = true
    try {
      rows = await api.get<RunRow[]>('/runs' + qs({ testId, classId, campaignId, search: search.trim() }))
    } catch (e) {
      notify.error('Не удалось загрузить результаты', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  async function openDetail(id: string) {
    detailOpen = true
    try {
      detail = await api.get<RunDetail>(`/runs/${id}`)
    } catch (e) {
      detailOpen = false
      notify.error('Не удалось открыть результат', { text: errorMessage(e) })
    }
  }

  async function exportCsv() {
    try {
      const csv = await api.get<string>(
        '/runs/export' +
          qs({
            testId: filters.testId,
            classId: filters.classId,
            campaignId: filters.campaignId,
            search: filters.search.trim(),
          }),
      )
      downloadText(`results-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      notify.toast('Файл выгружен')
    } catch (e) {
      notify.error('Не удалось выгрузить', { text: errorMessage(e) })
    }
  }

  async function removeRun(run: RunDetail) {
    const ok = await notify.confirm({
      title: 'Удалить результат?',
      text: `Прохождение «${run.testTitle}» ученика ${run.studentName} исчезнет безвозвратно, включая ответы.`,
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/runs/${run.id}`)
      detailOpen = false
      await loadRuns(filters.testId, filters.classId, filters.campaignId, filters.search)
      notify.toast('Результат удалён')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }

  function reset() {
    filters = { testId: '', classId: '', campaignId: '', search: '' }
  }

  const hasFilters = $derived(
    Boolean(filters.testId || filters.classId || filters.campaignId || filters.search.trim()),
  )
</script>

<svelte:head><title>Результаты · Психолоджик</title></svelte:head>

<PageHeader title="Результаты" subtitle="Все пройденные тесты — поимённо, не анонимно">
  {#snippet actions()}
    {#if hasFilters}
      <Button variant="ghost" icon="close" onclick={reset}>Сбросить фильтры</Button>
    {/if}
    <Button variant="secondary" icon="download" onclick={exportCsv} disabled={!rows.length}>
      Выгрузить CSV
    </Button>
  {/snippet}
</PageHeader>

<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
  <Input bind:value={filters.search} placeholder="Фамилия или имя…" icon="search" />
  <Select
    bind:value={filters.testId}
    placeholder="Все тесты"
    allowEmpty
    options={tests.map((t) => ({ value: t.id, label: t.title }))}
  />
  <Select
    bind:value={filters.classId}
    placeholder="Все классы"
    allowEmpty
    options={classes.map((c) => ({ value: c.id, label: c.archived ? `${c.name} (архив)` : c.name }))}
  />
  <Select
    bind:value={filters.campaignId}
    placeholder="Все выдачи"
    allowEmpty
    options={campaigns.map((c) => ({ value: c.id, label: c.title }))}
  />
</div>

{#if loading && !rows.length}
  <div class="bg-surface border border-line p-6"><Skeleton rows={5} /></div>
{:else if !rows.length}
  <Card padding={false}>
    <EmptyState
      icon="fileText"
      title={hasFilters ? 'Под фильтры ничего не подошло' : 'Результатов пока нет'}
      description={hasFilters
        ? 'Попробуйте снять часть условий.'
        : 'Как только ученики пройдут тест по QR-коду, их ответы появятся здесь.'}
    >
      {#snippet actions()}
        {#if hasFilters}
          <Button variant="secondary" onclick={reset}>Сбросить фильтры</Button>
        {:else}
          <Button icon="qr" href="/campaigns">Выдать тест классам</Button>
        {/if}
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <p class="text-xs text-faint mb-3">
    Найдено {countLabel(rows.length, 'результат', 'результата', 'результатов')}{rows.length >= 500
      ? ' (показаны последние 500)'
      : ''}
  </p>
  <Table
    columns={[
      { key: 'student', label: 'Ученик' },
      { key: 'class', label: 'Класс', align: 'center', width: '80px' },
      { key: 'test', label: 'Тест', hideOnMobile: true },
      { key: 'score', label: 'Балл', align: 'center', width: '110px' },
      { key: 'level', label: 'Уровень', width: '160px' },
      { key: 'date', label: 'Когда', width: '160px', hideOnMobile: true },
    ]}
    rows={rows}
  >
    {#snippet row(item)}
      <td class="px-4 py-3 align-middle">
        <button
          type="button"
          class="font-semibold text-ink hover:text-accent transition-colors cursor-pointer text-left"
          onclick={() => openDetail(item.id)}
        >
          {item.studentName}
        </button>
      </td>
      <td class="px-4 py-3 align-middle text-center"><Badge variant="neutral">{item.className}</Badge></td>
      <td class="px-4 py-3 align-middle text-muted text-xs hidden md:table-cell">{item.testTitle}</td>
      <td class="px-4 py-3 align-middle text-center tabular-nums">
        <span class="font-bold text-ink">{item.score ?? '—'}</span>
        {#if item.maxScore}<span class="text-faint text-xs"> / {item.maxScore}</span>{/if}
      </td>
      <td class="px-4 py-3 align-middle">
        {#if item.interpretationLabel}
          <span class="text-sm text-ink">{item.interpretationLabel}</span>
        {:else}
          <span class="text-xs text-faint">без уровня</span>
        {/if}
      </td>
      <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
        {formatDateTime(item.completedAt)}
      </td>
    {/snippet}
  </Table>
{/if}

<Modal bind:open={detailOpen} size="xl" title={detail?.studentName ?? 'Результат'} subtitle={detail ? `${detail.className} · ${detail.testTitle}` : ''}>
  {#if detail}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-surface-2 border border-line p-4">
        <div class="ng-label text-muted">Балл</div>
        <div class="text-2xl font-extrabold text-ink mt-1 tabular-nums">
          {detail.score ?? '—'}{#if detail.maxScore}<span class="text-muted text-base font-bold"> / {detail.maxScore}</span>{/if}
        </div>
      </div>
      <div class="bg-surface-2 border border-line p-4">
        <div class="ng-label text-muted">Доля</div>
        <div class="text-2xl font-extrabold text-ink mt-1 tabular-nums">
          {detail.percent !== null ? `${detail.percent}%` : '—'}
        </div>
      </div>
      <div class="bg-surface-2 border border-line p-4">
        <div class="ng-label text-muted">Уровень</div>
        <div class="text-base font-bold text-ink mt-2">{detail.interpretationLabel ?? 'не определён'}</div>
      </div>
    </div>

    {#if detail.interpretationText}
      <Alert variant="info" title="Что это значит" class="mb-6">{detail.interpretationText}</Alert>
    {/if}

    <div class="border border-line divide-y divide-line max-h-[380px] overflow-y-auto">
      {#each detail.answers as answer, index (answer.questionId)}
        <div class="px-4 py-3">
          <div class="flex items-start gap-3">
            <span class="text-xs text-faint tabular-nums shrink-0 mt-0.5">{index + 1}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-ink">{answer.questionText}</p>
              <p class="text-sm mt-1 {answer.answerText ? 'text-accent' : 'text-faint italic'}">
                {answer.answerText || 'без ответа'}
              </p>
              <span class="text-[10px] text-faint uppercase font-bold">
                {QUESTION_TYPE_LABELS[answer.type]}
              </span>
            </div>
            <span class="text-xs font-bold text-muted tabular-nums shrink-0">{answer.score} б.</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    {#if detail}
      <Button variant="ghost" size="sm" icon="user" href="/students?student={detail.studentId}">
        Карточка ученика
      </Button>
      <Button variant="ghost" size="sm" icon="trash" onclick={() => removeRun(detail!)}>Удалить</Button>
      <Button size="sm" onclick={() => (detailOpen = false)}>Закрыть</Button>
    {/if}
  {/snippet}
</Modal>
