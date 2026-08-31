<script lang="ts">
  import { page } from '$app/state'
  import {
    PageHeader,
    Card,
    Table,
    Badge,
    Button,
    Modal,
    Input,
    Select,
    Textarea,
    Tabs,
    EmptyState,
    Dropdown,
    DropdownItem,
    Alert,
    DateInput,
    Icon,
  } from '$ui'
  import { api, errorMessage, qs } from '$lib/api'
  import { notify } from '$lib/notify'
  import { ORIGIN_LABELS, TAG_PRESETS } from '$lib/catalog'
  import { formatDate, formatDateTime, formatRelative } from '$lib/format'
  import type { ClassRow, StudentDetail, StudentRow } from '$lib/types'

  let rows = $state<StudentRow[]>([])
  let classes = $state<ClassRow[]>([])
  let loading = $state(true)
  let tab = $state('all')
  let search = $state('')
  let classFilter = $state<string | number>('')

  let createOpen = $state(false)
  let detailOpen = $state(false)
  let transferOpen = $state(false)
  let busy = $state(false)

  let detail = $state<StudentDetail | null>(null)
  let detailTab = $state('overview')
  let noteDraft = $state('')
  let editingNoteId = $state('')

  let form = $state({ lastName: '', firstName: '', classId: '', birthDate: '', comment: '' })
  let transferClassId = $state<string | number>('')

  const activeClasses = $derived(classes.filter((c) => !c.archived))

  const TABS = $derived([
    { value: 'all', label: 'Все', badge: rows.length },
    { value: 'tracked', label: 'На карандаше', badge: rows.filter((r) => r.origin === 'TRACKED').length },
    { value: 'auto', label: 'Автоматические', badge: rows.filter((r) => r.origin === 'AUTO').length },
    {
      value: 'duplicates',
      label: 'Возможные дубли',
      badge: rows.filter((r) => r.possibleDuplicateOf).length,
    },
  ])

  const visible = $derived.by(() => {
    let list = rows
    if (tab === 'tracked') {
      list = list.filter((r) => r.origin === 'TRACKED')
    } else if (tab === 'auto') {
      list = list.filter((r) => r.origin === 'AUTO')
    } else if (tab === 'duplicates') {
      list = list.filter((r) => r.possibleDuplicateOf)
    }
    const needle = search.trim().toLowerCase()
    if (needle) {
      list = list.filter((r) => r.fullName.toLowerCase().includes(needle))
    }
    if (classFilter) {
      list = list.filter((r) => r.classId === classFilter)
    }
    return list
  })

  // Ссылки вида /students?classId=…&student=… приходят из других разделов.
  $effect(() => {
    const params = page.url.searchParams
    const cls = params.get('classId')
    const student = params.get('student')
    const wanted = params.get('tab')
    if (cls) {
      classFilter = cls
    }
    if (wanted) {
      tab = wanted
    }
    if (student) {
      void openDetail(student)
    }
  })

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    try {
      const [studentRows, classRows] = await Promise.all([
        api.get<StudentRow[]>('/students'),
        api.get<ClassRow[]>('/classes' + qs({ archived: true })),
      ])
      rows = studentRows
      classes = classRows
    } catch (e) {
      notify.error('Не удалось загрузить учеников', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  function openCreate() {
    form = { lastName: '', firstName: '', classId: String(classFilter || activeClasses[0]?.id || ''), birthDate: '', comment: '' }
    createOpen = true
  }

  async function create() {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.classId) {
      notify.warning('Заполните фамилию, имя и класс')
      return
    }
    busy = true
    try {
      await api.post('/students', {
        lastName: form.lastName.trim(),
        firstName: form.firstName.trim(),
        classId: form.classId,
        ...(form.birthDate ? { birthDate: form.birthDate } : {}),
        comment: form.comment.trim(),
      })
      createOpen = false
      await load()
      notify.toast('Ученик добавлен')
    } catch (e) {
      notify.error('Не удалось добавить ученика', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function openDetail(id: string) {
    detailTab = 'overview'
    noteDraft = ''
    editingNoteId = ''
    detailOpen = true
    try {
      detail = await api.get<StudentDetail>(`/students/${id}`)
    } catch (e) {
      detailOpen = false
      notify.error('Не удалось открыть карточку', { text: errorMessage(e) })
    }
  }

  async function refreshDetail() {
    if (detail) {
      detail = await api.get<StudentDetail>(`/students/${detail.id}`)
    }
    await load()
  }

  async function setOrigin(origin: 'TRACKED' | 'AUTO') {
    if (!detail) {
      return
    }
    try {
      await api.post(`/students/${detail.id}/origin`, { origin })
      await refreshDetail()
      notify.toast(origin === 'TRACKED' ? 'Ученик взят на карандаш' : 'Ученик снят с карандаша')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  function openTransfer() {
    transferClassId = detail?.classId ?? ''
    transferOpen = true
  }

  async function transfer() {
    if (!detail || !transferClassId) {
      return
    }
    busy = true
    try {
      await api.post(`/students/${detail.id}/transfer`, { classId: transferClassId })
      transferOpen = false
      await refreshDetail()
      notify.toast('Ученик переведён')
    } catch (e) {
      notify.error('Не удалось перевести', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function mergeInto(keepId: string, dropId: string) {
    const ok = await notify.confirm({
      title: 'Объединить карточки?',
      text: 'Результаты, заметки и метки переедут в одну карточку, вторая будет удалена. Отменить нельзя.',
      confirmText: 'Объединить',
    })
    if (!ok) {
      return
    }
    try {
      await api.post(`/students/${keepId}/merge`, { sourceId: dropId })
      detailOpen = false
      await load()
      notify.success('Карточки объединены')
    } catch (e) {
      notify.error('Не удалось объединить', { text: errorMessage(e) })
    }
  }

  async function dismissDuplicate(id: string) {
    try {
      await api.post(`/students/${id}/dismiss-duplicate`)
      await load()
      if (detail?.id === id) {
        detail = await api.get<StudentDetail>(`/students/${id}`)
      }
      notify.toast('Отметка снята')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function saveNote() {
    if (!detail || !noteDraft.trim()) {
      return
    }
    busy = true
    try {
      if (editingNoteId) {
        await api.patch(`/students/notes/${editingNoteId}`, { text: noteDraft.trim() })
      } else {
        await api.post(`/students/${detail.id}/notes`, { text: noteDraft.trim() })
      }
      noteDraft = ''
      editingNoteId = ''
      await refreshDetail()
    } catch (e) {
      notify.error('Не удалось сохранить заметку', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function removeNote(noteId: string) {
    const ok = await notify.confirm({ title: 'Удалить заметку?', confirmText: 'Удалить', danger: true })
    if (!ok) {
      return
    }
    try {
      await api.del(`/students/notes/${noteId}`)
      await refreshDetail()
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }

  async function addTag(label: string, color: string) {
    if (!detail) {
      return
    }
    try {
      await api.post(`/students/${detail.id}/tags`, { label, color })
      await refreshDetail()
    } catch (e) {
      notify.error('Не удалось поставить метку', { text: errorMessage(e) })
    }
  }

  async function removeTag(tagId: string) {
    try {
      await api.del(`/students/tags/${tagId}`)
      await refreshDetail()
    } catch (e) {
      notify.error('Не удалось снять метку', { text: errorMessage(e) })
    }
  }

  async function saveComment() {
    if (!detail) {
      return
    }
    busy = true
    try {
      await api.patch(`/students/${detail.id}`, { comment: detail.comment })
      await refreshDetail()
      notify.toast('Сохранено')
    } catch (e) {
      notify.error('Не удалось сохранить', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function removeStudent() {
    if (!detail) {
      return
    }
    const ok = await notify.confirm({
      title: `Удалить ${detail.fullName}?`,
      text: 'Карточка удалится безвозвратно. Если у ученика есть результаты тестов, удалить нельзя — только отправить в архив.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/students/${detail.id}`)
      detailOpen = false
      await load()
      notify.toast('Карточка удалена')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>Ученики · Психолоджик</title></svelte:head>

<PageHeader
  title="Ученики"
  subtitle="Заведённые вручную «на карандаше» и появившиеся сами после прохождения тестов"
>
  {#snippet actions()}
    <Button icon="userPlus" onclick={openCreate} disabled={!activeClasses.length}>Добавить ученика</Button>
  {/snippet}
</PageHeader>

{#if !activeClasses.length && !loading}
  <Alert variant="warning" title="Сначала создайте классы" class="mb-6">
    Ученик всегда принадлежит классу — без классов его некуда записать.
    {#snippet actions()}
      <Button size="sm" variant="secondary" href="/classes">К классам</Button>
    {/snippet}
  </Alert>
{/if}

<Tabs bind:value={tab} tabs={TABS} class="mb-4" />

<div class="flex flex-col sm:flex-row gap-3 mb-6">
  <Input bind:value={search} placeholder="Поиск по фамилии или имени…" icon="search" class="flex-1" />
  <Select
    bind:value={classFilter}
    placeholder="Все классы"
    allowEmpty
    options={activeClasses.map((c) => ({ value: c.id, label: c.name }))}
    class="sm:w-52"
  />
</div>

{#if tab === 'duplicates' && visible.length}
  <Alert variant="warning" title="Похоже на одного и того же человека" class="mb-4">
    Ученик подписался чуть иначе, чем записано в карточке. Проверьте пары и объедините карточки — или отметьте,
    что это разные люди.
  </Alert>
{/if}

{#if !loading && !visible.length}
  <Card padding={false}>
    <EmptyState
      icon="users"
      title={tab === 'duplicates' ? 'Дублей не найдено' : 'Учеников пока нет'}
      description={tab === 'duplicates'
        ? 'Система сама сверяет фамилии внутри класса. Пока совпадений нет.'
        : 'Заведите тех, за кем нужен присмотр. Остальные появятся здесь автоматически, когда пройдут тест по QR-коду.'}
    >
      {#snippet actions()}
        {#if tab !== 'duplicates' && activeClasses.length}
          <Button icon="userPlus" onclick={openCreate}>Добавить ученика</Button>
        {/if}
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <Table
    columns={[
      { key: 'name', label: 'Ученик' },
      { key: 'class', label: 'Класс', align: 'center', width: '90px' },
      { key: 'origin', label: 'Категория', width: '150px', hideOnMobile: true },
      { key: 'runs', label: 'Тестов', align: 'center', width: '90px', hideOnMobile: true },
      { key: 'last', label: 'Последний', width: '150px', hideOnMobile: true },
      { key: 'actions', label: '', align: 'right', width: '60px' },
    ]}
    rows={visible}
  >
    {#snippet row(item)}
      <td class="px-4 py-3 align-middle">
        <button
          type="button"
          class="text-left cursor-pointer group"
          onclick={() => openDetail(item.id)}
        >
          <span class="font-semibold text-ink group-hover:text-accent transition-colors">{item.fullName}</span>
          {#if item.tags.length}
            <span class="flex flex-wrap gap-1 mt-1">
              {#each item.tags.slice(0, 3) as tag (tag.id)}
                <Badge variant={tag.color}>{tag.label}</Badge>
              {/each}
            </span>
          {/if}
          {#if item.possibleDuplicateOf}
            <span class="block text-[11px] text-warning mt-1">
              похож на {item.possibleDuplicateOf.fullName}
            </span>
          {/if}
        </button>
      </td>
      <td class="px-4 py-3 align-middle text-center">
        <Badge variant="neutral">{item.className}</Badge>
      </td>
      <td class="px-4 py-3 align-middle hidden md:table-cell">
        <Badge variant={item.origin === 'TRACKED' ? 'accent' : 'neutral'}>
          {ORIGIN_LABELS[item.origin]}
        </Badge>
      </td>
      <td class="px-4 py-3 align-middle text-center tabular-nums text-muted hidden md:table-cell">
        {item.runCount}
      </td>
      <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
        {formatRelative(item.lastRunAt)}
      </td>
      <td class="px-4 py-3 align-middle text-right">
        <Dropdown align="right" width={240}>
          {#snippet trigger()}
            <span class="inline-flex p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer">
              <Icon name="more" size={18} />
            </span>
          {/snippet}
          {#snippet children()}
            <DropdownItem icon="user" onclick={() => openDetail(item.id)}>Открыть карточку</DropdownItem>
            {#if item.origin === 'AUTO'}
              <DropdownItem
                icon="star"
                onclick={async () => {
                  await api.post(`/students/${item.id}/origin`, { origin: 'TRACKED' })
                  await load()
                  notify.toast('Взят на карандаш')
                }}
              >
                Взять на карандаш
              </DropdownItem>
            {/if}
            {#if item.possibleDuplicateOf}
              <div class="my-1 border-t border-line"></div>
              <DropdownItem
                icon="merge"
                onclick={() => mergeInto(item.possibleDuplicateOf!.id, item.id)}
              >
                Объединить карточки
              </DropdownItem>
              <DropdownItem icon="split" onclick={() => dismissDuplicate(item.id)}>Это разные люди</DropdownItem>
            {/if}
          {/snippet}
        </Dropdown>
      </td>
    {/snippet}
  </Table>
{/if}

<!-- ── Карточка ученика ──────────────────────────────────────────────────── -->
<Modal bind:open={detailOpen} size="xl" title={detail?.fullName ?? 'Карточка ученика'} subtitle={detail ? `${detail.className} · ${ORIGIN_LABELS[detail.origin]}` : ''}>
  {#if detail}
    {#if detail.possibleDuplicateOf}
      <Alert variant="warning" title="Возможный дубль" class="mb-5">
        Похож на ученика <b>{detail.possibleDuplicateOf.fullName}</b> из того же класса.
        {#snippet actions()}
          <Button size="sm" icon="merge" onclick={() => mergeInto(detail!.possibleDuplicateOf!.id, detail!.id)}>
            Объединить
          </Button>
          <Button size="sm" variant="secondary" onclick={() => dismissDuplicate(detail!.id)}>Разные</Button>
        {/snippet}
      </Alert>
    {/if}

    <Tabs
      bind:value={detailTab}
      tabs={[
        { value: 'overview', label: 'Обзор', icon: 'user' },
        { value: 'runs', label: 'Результаты', icon: 'fileText', badge: detail.runs.length },
        { value: 'notes', label: 'Заметки', icon: 'edit', badge: detail.notes.length },
      ]}
      class="mb-5"
    />

    {#if detailTab === 'overview'}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <dl class="divide-y divide-line text-sm">
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Класс</dt>
            <dd class="text-ink font-semibold">{detail.className}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Категория</dt>
            <dd><Badge variant={detail.origin === 'TRACKED' ? 'accent' : 'neutral'}>{ORIGIN_LABELS[detail.origin]}</Badge></dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Дата рождения</dt>
            <dd class="text-ink">{formatDate(detail.birthDate)}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">В базе с</dt>
            <dd class="text-ink">{formatDate(detail.createdAt)}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Пройдено тестов</dt>
            <dd class="text-ink font-semibold tabular-nums">{detail.runs.length}</dd>
          </div>
        </dl>

        <div>
          <div class="ng-label text-muted mb-2">Метки</div>
          <div class="flex flex-wrap gap-1.5 mb-3">
            {#each detail.tags as tag (tag.id)}
              <button
                type="button"
                class="cursor-pointer"
                title="Снять метку"
                onclick={() => removeTag(tag.id)}
              >
                <Badge variant={tag.color}>{tag.label} ✕</Badge>
              </button>
            {:else}
              <span class="text-xs text-faint">Меток нет</span>
            {/each}
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each TAG_PRESETS.filter((p) => !detail!.tags.some((t) => t.label === p.label)) as preset (preset.label)}
              <button
                type="button"
                class="text-[11px] px-2 py-0.5 border border-line-strong text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer"
                onclick={() => addTag(preset.label, preset.color)}
              >
                + {preset.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-5">
        <Textarea bind:value={detail.comment} label="Комментарий" rows={3} placeholder="Короткая пометка о ситуации ученика" />
        <div class="mt-3">
          <Button size="sm" icon="save" loading={busy} onclick={saveComment}>Сохранить комментарий</Button>
        </div>
      </div>
    {:else if detailTab === 'runs'}
      {#if detail.runs.length}
        <div class="border border-line divide-y divide-line max-h-[420px] overflow-y-auto">
          {#each detail.runs as run (run.id)}
            <a href="/results?run={run.id}" class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2 transition-colors">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-ink truncate">{run.testTitle}</div>
                <div class="text-xs text-faint">{run.className} · {formatDateTime(run.completedAt)}</div>
              </div>
              <div class="shrink-0 text-right">
                {#if run.interpretationLabel}
                  <div class="text-sm font-bold text-ink">{run.interpretationLabel}</div>
                {/if}
                <div class="text-xs text-muted tabular-nums">
                  {run.score ?? '—'}{run.maxScore ? ` из ${run.maxScore}` : ''}
                </div>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <EmptyState icon="fileText" title="Тестов ещё не проходил" />
      {/if}
    {:else}
      <div class="space-y-4">
        <Textarea
          bind:value={noteDraft}
          label={editingNoteId ? 'Правка заметки' : 'Новая заметка'}
          rows={3}
          placeholder="Наблюдение, содержание беседы, договорённости…"
        />
        <div class="flex gap-2">
          <Button size="sm" icon="check" loading={busy} onclick={saveNote} disabled={!noteDraft.trim()}>
            {editingNoteId ? 'Сохранить правку' : 'Добавить заметку'}
          </Button>
          {#if editingNoteId}
            <Button size="sm" variant="ghost" onclick={() => { editingNoteId = ''; noteDraft = '' }}>Отмена</Button>
          {/if}
        </div>

        {#if detail.notes.length}
          <div class="border border-line divide-y divide-line max-h-[320px] overflow-y-auto">
            {#each detail.notes as note (note.id)}
              <article class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <p class="text-sm text-ink whitespace-pre-wrap flex-1">{note.text}</p>
                  <div class="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Изменить"
                      class="p-1 text-faint hover:text-accent transition-colors cursor-pointer"
                      onclick={() => { editingNoteId = note.id; noteDraft = note.text }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Удалить"
                      class="p-1 text-faint hover:text-danger transition-colors cursor-pointer"
                      onclick={() => removeNote(note.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <div class="text-[11px] text-faint mt-1.5">
                  {note.authorName} · {formatDateTime(note.createdAt)}
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <EmptyState icon="edit" title="Заметок нет" description="Всё, что вы здесь напишете, видят только психологи." />
        {/if}
      </div>
    {/if}
  {/if}

  {#snippet footer()}
    {#if detail}
      {#if detail.origin === 'AUTO'}
        <Button variant="secondary" size="sm" icon="star" onclick={() => setOrigin('TRACKED')}>
          Взять на карандаш
        </Button>
      {:else}
        <Button variant="ghost" size="sm" icon="slash" onclick={() => setOrigin('AUTO')}>Снять с карандаша</Button>
      {/if}
      <Button variant="secondary" size="sm" icon="arrowRight" onclick={openTransfer}>Перевести в класс</Button>
      <Button variant="ghost" size="sm" icon="trash" onclick={removeStudent}>Удалить</Button>
      <Button size="sm" onclick={() => (detailOpen = false)}>Закрыть</Button>
    {/if}
  {/snippet}
</Modal>

<Modal bind:open={transferOpen} title="Перевод ученика" size="sm">
  <p class="text-sm text-muted mb-4">
    {detail?.fullName ?? ''} перейдёт в другой класс. Прошлые результаты останутся привязаны к тому классу,
    в котором они получены.
  </p>
  <Select
    bind:value={transferClassId}
    label="Новый класс"
    options={activeClasses.map((c) => ({ value: c.id, label: c.name, disabled: c.id === detail?.classId }))}
  />
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (transferOpen = false)}>Отмена</Button>
    <Button icon="arrowRight" loading={busy} onclick={transfer}>Перевести</Button>
  {/snippet}
</Modal>

<Modal bind:open={createOpen} title="Новый ученик" subtitle="Ученик «на карандаше» — за ним нужен присмотр" size="md">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <Input bind:value={form.lastName} label="Фамилия" icon="user" placeholder="Иванов" required />
      <Input bind:value={form.firstName} label="Имя" placeholder="Иван" required />
    </div>
    <Select
      bind:value={form.classId}
      label="Класс"
      options={activeClasses.map((c) => ({ value: c.id, label: c.name }))}
    />
    <DateInput bind:value={form.birthDate} label="Дата рождения" hint="Необязательно" />
    <Textarea bind:value={form.comment} label="Комментарий" rows={3} placeholder="Почему ученик на карандаше" />
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (createOpen = false)}>Отмена</Button>
    <Button icon="check" loading={busy} onclick={create}>Добавить</Button>
  {/snippet}
</Modal>
