<script lang="ts">
  import { page } from '$app/state'
  import {
    PageHeader,
    Card,
    Badge,
    Button,
    Modal,
    Select,
    Input,
    Checkbox,
    EmptyState,
    Progress,
    Dropdown,
    DropdownItem,
    Alert,
    DateInput,
    Icon,
  } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { formatDate, formatDateTime, countLabel } from '$lib/format'
  import type { CampaignRow, ClassRow, TestSummary } from '$lib/types'

  let campaigns = $state<CampaignRow[]>([])
  let classes = $state<ClassRow[]>([])
  let tests = $state<TestSummary[]>([])
  let loading = $state(true)
  let busy = $state(false)

  let createOpen = $state(false)
  let form = $state({ testId: '' as string | number, title: '', spare: 2 as string | number, expiresAt: '' })
  let selected = $state<Record<string, boolean>>({})

  const activeClasses = $derived(classes.filter((c) => !c.archived))
  const publishedTests = $derived(tests.filter((t) => t.isPublished))
  const chosenClasses = $derived(activeClasses.filter((c) => selected[c.id]))
  const totalCodes = $derived(
    chosenClasses.reduce((sum, c) => sum + Math.max(1, c.plannedSize + (Number(form.spare) || 0)), 0),
  )
  // 42 кода помещается на лист A4 при плотной сетке 6×7.
  const sheets = $derived(chosenClasses.reduce((sum, c) => sum + Math.ceil(Math.max(1, c.plannedSize + (Number(form.spare) || 0)) / 42), 0))

  $effect(() => {
    void load()
  })

  // Переход «Выдать классам» из карточки теста подставляет методику сразу.
  let autoOpened = false
  $effect(() => {
    const testId = page.url.searchParams.get('testId')
    if (testId && tests.length && classes.length && !autoOpened) {
      autoOpened = true
      openCreate(testId)
    }
  })

  async function load() {
    loading = true
    try {
      const [campaignRows, classRows, testRows] = await Promise.all([
        api.get<CampaignRow[]>('/campaigns'),
        api.get<ClassRow[]>('/classes'),
        api.get<TestSummary[]>('/tests'),
      ])
      campaigns = campaignRows
      classes = classRows
      tests = testRows
      if (createOpen) {
        resetSelection()
      }
    } catch (e) {
      notify.error('Не удалось загрузить выдачи', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  /**
   * Отметки классов заводим сразу для всех: привязать bind:checked к
   * отсутствующему ключу нельзя — у пропса есть значение по умолчанию,
   * и Svelte на undefined выбрасывает props_invalid_value.
   */
  function resetSelection() {
    selected = Object.fromEntries(activeClasses.map((c) => [c.id, false]))
  }

  function openCreate(testId?: string) {
    form = { testId: testId ?? publishedTests[0]?.id ?? '', title: '', spare: 2, expiresAt: '' }
    resetSelection()
    createOpen = true
  }

  function toggleParallel(number: number) {
    const parallel = activeClasses.filter((c) => c.number === number)
    const allOn = parallel.every((c) => selected[c.id])
    for (const cls of parallel) {
      selected[cls.id] = !allOn
    }
  }

  async function create() {
    const classIds = chosenClasses.map((c) => c.id)
    if (!form.testId) {
      notify.warning('Выберите тест')
      return
    }
    if (!classIds.length) {
      notify.warning('Отметьте хотя бы один класс')
      return
    }
    busy = true
    try {
      const created = await api.post<CampaignRow>('/campaigns', {
        testId: form.testId,
        title: form.title.trim() || undefined,
        classIds,
        spare: Number(form.spare) || 0,
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
      })
      createOpen = false
      await load()
      const go = await notify.confirm({
        title: 'Коды готовы',
        text: `Выпущено ${created.totalIssued} кодов на ${countLabel(created.classes.length, 'класс', 'класса', 'классов')}. Открыть лист для печати?`,
        confirmText: 'К печати',
        cancelText: 'Позже',
        icon: 'success',
      })
      if (go) {
        location.href = `/print/${created.id}`
      }
    } catch (e) {
      notify.error('Не удалось создать выдачу', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function close(campaign: CampaignRow) {
    const ok = await notify.confirm({
      title: `Закрыть «${campaign.title}»?`,
      text: 'Все ещё не использованные коды перестанут работать. Уже полученные результаты останутся на месте.',
      confirmText: 'Закрыть выдачу',
    })
    if (!ok) {
      return
    }
    try {
      await api.post(`/campaigns/${campaign.id}/close`)
      await load()
      notify.toast('Выдача закрыта')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function reopen(campaign: CampaignRow) {
    try {
      await api.post(`/campaigns/${campaign.id}/reopen`)
      await load()
      notify.toast('Выдача открыта заново')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function addCodes(campaign: CampaignRow, classId: string, className: string) {
    const value = await notify.prompt({
      title: `Дополнительные коды для ${className}`,
      text: 'Например, если в класс пришли новенькие или лист испортился.',
      inputLabel: 'Сколько кодов выпустить',
      inputValue: '3',
      inputType: 'number',
      confirmText: 'Выпустить',
    })
    const count = Number(value)
    if (!value || !Number.isFinite(count) || count < 1) {
      return
    }
    try {
      await api.post(`/campaigns/${campaign.id}/codes`, { classId, count: Math.min(60, Math.round(count)) })
      await load()
      notify.toast('Коды выпущены')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function remove(campaign: CampaignRow) {
    const ok = await notify.confirm({
      title: `Удалить «${campaign.title}»?`,
      text: 'Удалить можно только выдачу, по которой ещё никто не проходил тест.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/campaigns/${campaign.id}`)
      await load()
      notify.toast('Выдача удалена')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }

  const parallels = $derived([...new Set(activeClasses.map((c) => c.number))].sort((a, b) => a - b))
</script>

<svelte:head><title>Выдача QR · Психолоджик</title></svelte:head>

<PageHeader
  title="Выдача QR"
  subtitle="Выберите тест и классы — платформа выпустит одноразовые коды и подготовит лист для печати"
>
  {#snippet actions()}
    <Button icon="qr" onclick={openCreate} disabled={!publishedTests.length || !activeClasses.length}>
      Новая выдача
    </Button>
  {/snippet}
</PageHeader>

{#if !loading && (!publishedTests.length || !activeClasses.length)}
  <Alert variant="warning" title="Не хватает данных" class="mb-6">
    {#if !activeClasses.length}Сначала создайте классы.{/if}
    {#if !publishedTests.length}{' '}Нужен хотя бы один опубликованный тест.{/if}
    {#snippet actions()}
      {#if !activeClasses.length}
        <Button size="sm" variant="secondary" href="/classes">К классам</Button>
      {:else}
        <Button size="sm" variant="secondary" href="/tests">К тестам</Button>
      {/if}
    {/snippet}
  </Alert>
{/if}

{#if !loading && !campaigns.length}
  <Card padding={false}>
    <EmptyState
      icon="qr"
      title="Выдач ещё не было"
      description="Одна выдача — это пачка одноразовых QR-кодов на выбранные классы. Ученик сканирует код, вписывает фамилию и имя и сразу попадает в тест. Логины и пароли не нужны."
    >
      {#snippet actions()}
        <Button icon="qr" onclick={openCreate} disabled={!publishedTests.length || !activeClasses.length}>
          Создать выдачу
        </Button>
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <div class="space-y-4">
    {#each campaigns as campaign (campaign.id)}
      <Card padding={false} accent={!campaign.closedAt}>
        {#snippet header()}
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-[15px] font-bold text-ink truncate">{campaign.title}</h3>
              {#if campaign.closedAt}
                <Badge variant="neutral" dot>Закрыта</Badge>
              {:else if campaign.expiresAt && new Date(campaign.expiresAt) < new Date()}
                <Badge variant="warning" dot>Срок истёк</Badge>
              {:else}
                <Badge variant="success" dot>Идёт</Badge>
              {/if}
            </div>
            <p class="text-xs text-muted mt-0.5">
              {campaign.testTitle} · {formatDate(campaign.createdAt)}
              {#if campaign.expiresAt}· до {formatDate(campaign.expiresAt)}{/if}
            </p>
          </div>
        {/snippet}

        {#snippet actions()}
          <Button size="sm" variant="secondary" icon="printer" href="/print/{campaign.id}">Печать</Button>
          <Dropdown align="right" width={240}>
            {#snippet trigger()}
              <span class="inline-flex p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer">
                <Icon name="more" size={18} />
              </span>
            {/snippet}
            {#snippet children()}
              <DropdownItem icon="fileText" onclick={() => (location.href = `/results?campaignId=${campaign.id}`)}>
                Результаты выдачи
              </DropdownItem>
              {#if campaign.closedAt}
                <DropdownItem icon="refresh" onclick={() => reopen(campaign)}>Открыть заново</DropdownItem>
              {:else}
                <DropdownItem icon="slash" onclick={() => close(campaign)}>Закрыть выдачу</DropdownItem>
              {/if}
              <div class="my-1 border-t border-line"></div>
              <DropdownItem icon="trash" danger onclick={() => remove(campaign)}>Удалить</DropdownItem>
            {/snippet}
          </Dropdown>
        {/snippet}

        <div class="px-5 py-4">
          <div class="flex items-center justify-between gap-4 mb-3">
            <span class="text-sm text-muted">
              Прошли <b class="text-ink">{campaign.totalUsed}</b> из {campaign.totalIssued} выданных кодов
            </span>
            <span class="text-sm font-bold text-ink tabular-nums">
              {campaign.totalIssued ? Math.round((campaign.totalUsed / campaign.totalIssued) * 100) : 0}%
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
            {#each campaign.classes as cls (cls.classId)}
              <div class="flex items-center gap-3">
                <span class="w-11 shrink-0 text-sm font-bold text-ink">{cls.className}</span>
                <div class="flex-1 min-w-0">
                  <Progress
                    value={cls.used}
                    max={cls.issued}
                    variant={cls.used >= cls.issued - 2 ? 'success' : cls.used > 0 ? 'accent' : 'neutral'}
                  />
                </div>
                <span class="text-xs text-faint tabular-nums shrink-0 w-14 text-right">
                  {cls.used}/{cls.issued}
                </span>
                {#if !campaign.closedAt}
                  <button
                    type="button"
                    aria-label="Дополнительные коды"
                    title="Выпустить дополнительные коды"
                    class="p-1 text-faint hover:text-accent transition-colors cursor-pointer shrink-0"
                    onclick={() => addCodes(campaign, cls.classId, cls.className)}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>
    {/each}
  </div>
{/if}

<Modal bind:open={createOpen} title="Новая выдача" subtitle="Один тест — сразу нескольким классам" size="lg">
  <div class="space-y-5">
    <Select
      bind:value={form.testId}
      label="Тест"
      placeholder="Выберите методику"
      options={publishedTests.map((t) => ({ value: t.id, label: `${t.title} · ${t.questionCount} вопр.` }))}
    />

    <div>
      <div class="flex items-center justify-between gap-3 mb-2">
        <span class="ng-label text-muted">Классы</span>
        <div class="flex flex-wrap gap-1">
          {#each parallels as number (number)}
            <button
              type="button"
              class="text-[11px] px-2 py-0.5 border border-line-strong text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer"
              onclick={() => toggleParallel(number)}
            >
              {number}-е
            </button>
          {/each}
        </div>
      </div>
      <div class="border border-line max-h-64 overflow-y-auto divide-y divide-line">
        {#each activeClasses as cls (cls.id)}
          <label class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors cursor-pointer">
            <Checkbox bind:checked={selected[cls.id]} />
            <span class="font-bold text-ink w-10">{cls.name}</span>
            <span class="text-xs text-muted flex-1 truncate">{cls.homeroomTeacher || 'руководитель не указан'}</span>
            <span class="text-xs text-faint tabular-nums shrink-0">{cls.plannedSize} чел.</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input
        bind:value={form.spare}
        label="Запасных кодов на класс"
        type="number"
        min={0}
        max={20}
        hint="На случай испорченного листа или новичков"
      />
      <DateInput bind:value={form.expiresAt} label="Действуют до" hint="Необязательно" />
    </div>

    <Input
      bind:value={form.title}
      label="Название выдачи"
      placeholder="Осенний срез тревожности"
      hint="Если не заполнять, возьмётся название теста"
    />

    {#if chosenClasses.length}
      <Alert variant="info">
        Будет выпущено <b>{totalCodes}</b> {countLabel(totalCodes, 'код', 'кода', 'кодов')} на
        {countLabel(chosenClasses.length, 'класс', 'класса', 'классов')} — примерно
        {countLabel(sheets, 'лист', 'листа', 'листов')} A4 при плотной печати.
      </Alert>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="secondary" onclick={() => (createOpen = false)}>Отмена</Button>
    <Button icon="qr" loading={busy} onclick={create} disabled={!chosenClasses.length}>
      Выпустить коды
    </Button>
  {/snippet}
</Modal>
