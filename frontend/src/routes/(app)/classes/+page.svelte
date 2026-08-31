<script lang="ts">
  import {
    PageHeader,
    Card,
    Table,
    Badge,
    Button,
    Modal,
    Input,
    Select,
    Tabs,
    EmptyState,
    Dropdown,
    DropdownItem,
    Icon,
  } from '$ui'
  import { api, errorMessage, qs } from '$lib/api'
  import { notify } from '$lib/notify'
  import { CLASS_LETTERS, CLASS_NUMBERS } from '$lib/catalog'
  import type { ClassRow } from '$lib/types'

  let rows = $state<ClassRow[]>([])
  let loading = $state(true)
  let tab = $state('active')

  let createOpen = $state(false)
  let editOpen = $state(false)
  let transferOpen = $state(false)
  let busy = $state(false)

  let form = $state({ number: '' as string | number, letter: '', plannedSize: 25 as string | number, homeroomTeacher: '' })
  let editing = $state<ClassRow | null>(null)
  let editForm = $state({ plannedSize: 0 as string | number, homeroomTeacher: '' })
  let transferForm = $state({ number: '' as string | number, letter: '' })

  const active = $derived(rows.filter((r) => !r.archived))
  const archived = $derived(rows.filter((r) => r.archived))
  const visible = $derived(tab === 'active' ? active : archived)

  const totalPlanned = $derived(active.reduce((sum, r) => sum + r.plannedSize, 0))
  const totalStudents = $derived(active.reduce((sum, r) => sum + r.studentCount, 0))

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    try {
      rows = await api.get<ClassRow[]>('/classes' + qs({ archived: true }))
    } catch (e) {
      notify.error('Не удалось загрузить классы', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  /** Буквы, которые уже заняты в выбранной параллели, — их не предлагаем. */
  const takenLetters = $derived(
    new Set(active.filter((r) => String(r.number) === String(form.number)).map((r) => r.letter)),
  )

  function openCreate() {
    form = { number: '', letter: '', plannedSize: 25, homeroomTeacher: '' }
    createOpen = true
  }

  async function create() {
    if (!form.number || !form.letter) {
      notify.warning('Выберите номер и букву класса')
      return
    }
    busy = true
    try {
      await api.post('/classes', {
        number: Number(form.number),
        letter: form.letter,
        plannedSize: Number(form.plannedSize) || 0,
        homeroomTeacher: form.homeroomTeacher.trim(),
      })
      createOpen = false
      await load()
      notify.toast(`Класс ${form.number}${form.letter} создан`)
    } catch (e) {
      notify.error('Не удалось создать класс', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  function openEdit(row: ClassRow) {
    editing = row
    editForm = { plannedSize: row.plannedSize, homeroomTeacher: row.homeroomTeacher }
    editOpen = true
  }

  async function saveEdit() {
    if (!editing) {
      return
    }
    busy = true
    try {
      await api.patch(`/classes/${editing.id}`, {
        plannedSize: Number(editForm.plannedSize) || 0,
        homeroomTeacher: editForm.homeroomTeacher.trim(),
      })
      editOpen = false
      await load()
      notify.toast('Класс обновлён')
    } catch (e) {
      notify.error('Не удалось сохранить', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  function openTransfer(row: ClassRow) {
    editing = row
    transferForm = { number: Math.min(11, row.number + 1), letter: row.letter }
    transferOpen = true
  }

  async function transfer() {
    if (!editing || !transferForm.number || !transferForm.letter) {
      return
    }
    const target = `${transferForm.number}${transferForm.letter}`
    const merging = active.some((r) => r.name === target && r.id !== editing?.id)
    const ok = await notify.confirm({
      title: `Перевести ${editing.name} → ${target}?`,
      text: merging
        ? `Класс ${target} уже существует: ученики ${editing.name} перейдут в него, а ${editing.name} уйдёт в архив. История прохождений сохранится как есть.`
        : `Класс сменит название. Ученики и история прохождений останутся на месте.`,
      confirmText: 'Перевести',
    })
    if (!ok) {
      return
    }
    busy = true
    try {
      await api.post(`/classes/${editing.id}/transfer`, {
        number: Number(transferForm.number),
        letter: transferForm.letter,
      })
      transferOpen = false
      await load()
      notify.toast(`Класс переведён в ${target}`)
    } catch (e) {
      notify.error('Не удалось перевести класс', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function promoteYear() {
    const ok = await notify.confirm({
      title: 'Перевести школу на следующий год?',
      text: 'Каждый класс поднимется на параллель выше, одиннадцатые уйдут в архив как выпущенные вместе со своими учениками. Отменить одной кнопкой не получится.',
      confirmText: 'Перевести всё',
      danger: true,
    })
    if (!ok) {
      return
    }
    busy = true
    try {
      const res = await api.post<{ promoted: number; graduated: number }>('/classes/promote-year')
      await load()
      notify.success('Школа переведена на новый учебный год', {
        text: `Поднято классов: ${res.promoted}. Выпущено: ${res.graduated}.`,
      })
    } catch (e) {
      notify.error('Не удалось перевести школу', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function archive(row: ClassRow) {
    const ok = await notify.confirm({
      title: `Отправить ${row.name} в архив?`,
      text: 'Класс исчезнет из рабочих списков, но результаты и ученики сохранятся. Вернуть можно в любой момент.',
      confirmText: 'В архив',
    })
    if (!ok) {
      return
    }
    try {
      await api.post(`/classes/${row.id}/archive`)
      await load()
      notify.toast('Класс в архиве')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function restore(row: ClassRow) {
    try {
      await api.post(`/classes/${row.id}/restore`)
      await load()
      notify.toast('Класс восстановлен')
    } catch (e) {
      notify.error('Не удалось восстановить', { text: errorMessage(e) })
    }
  }

  async function remove(row: ClassRow) {
    const ok = await notify.confirm({
      title: `Удалить класс ${row.name}?`,
      text: 'Вместе с классом удалятся карточки его учеников. Удаление доступно, только пока в классе нет результатов тестирования.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/classes/${row.id}`)
      await load()
      notify.toast('Класс удалён')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>Классы · Психолоджик</title></svelte:head>

<PageHeader
  title="Классы"
  subtitle="Численность класса задаётся здесь — по ней печатается пачка QR-кодов"
>
  {#snippet actions()}
    <Button variant="secondary" icon="trendUp" onclick={promoteYear} disabled={!active.length}>
      Новый учебный год
    </Button>
    <Button icon="plus" onclick={openCreate}>Создать класс</Button>
  {/snippet}
</PageHeader>

{#if active.length}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
    <div class="bg-surface border border-line p-4">
      <div class="ng-label text-muted">Классов</div>
      <div class="text-2xl font-extrabold text-ink mt-1">{active.length}</div>
    </div>
    <div class="bg-surface border border-line p-4">
      <div class="ng-label text-muted">По списку</div>
      <div class="text-2xl font-extrabold text-ink mt-1">{totalPlanned}</div>
    </div>
    <div class="bg-surface border border-line p-4">
      <div class="ng-label text-muted">В базе</div>
      <div class="text-2xl font-extrabold text-ink mt-1">{totalStudents}</div>
    </div>
    <div class="bg-surface border border-line p-4">
      <div class="ng-label text-muted">Без руководителя</div>
      <div class="text-2xl font-extrabold text-ink mt-1">
        {active.filter((r) => !r.homeroomTeacher).length}
      </div>
    </div>
  </div>
{/if}

<Tabs
  bind:value={tab}
  tabs={[
    { value: 'active', label: 'Действующие', badge: active.length },
    { value: 'archived', label: 'Архив', badge: archived.length },
  ]}
  class="mb-6"
/>

{#if !loading && !visible.length}
  <Card padding={false}>
    <EmptyState
      icon="grid"
      title={tab === 'active' ? 'Классов пока нет' : 'Архив пуст'}
      description={tab === 'active'
        ? 'Создайте классы школы: номер, букву, численность и классного руководителя. Дальше по ним будут печататься QR-коды.'
        : 'Сюда попадают выпущенные и объединённые классы.'}
    >
      {#snippet actions()}
        {#if tab === 'active'}<Button icon="plus" onclick={openCreate}>Создать класс</Button>{/if}
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <Table
    columns={[
      { key: 'name', label: 'Класс', width: '110px' },
      { key: 'teacher', label: 'Классный руководитель' },
      { key: 'size', label: 'Численность', align: 'center', width: '150px' },
      { key: 'students', label: 'В базе', align: 'center', width: '160px', hideOnMobile: true },
      { key: 'runs', label: 'Прохождений', align: 'center', width: '130px', hideOnMobile: true },
      { key: 'actions', label: '', align: 'right', width: '60px' },
    ]}
    rows={visible}
    empty="Ничего не найдено"
  >
    {#snippet row(item)}
      <td class="px-4 py-3 align-middle">
        <div class="flex items-center gap-2.5">
          <span
            class="w-9 h-9 shrink-0 flex items-center justify-center font-extrabold text-sm {item.archived
              ? 'bg-surface-3 text-faint'
              : 'bg-accent text-on-accent'}"
          >
            {item.name}
          </span>
        </div>
      </td>
      <td class="px-4 py-3 align-middle">
        {#if item.homeroomTeacher}
          <span class="text-ink">{item.homeroomTeacher}</span>
        {:else}
          <span class="text-faint text-xs">не указан</span>
        {/if}
      </td>
      <td class="px-4 py-3 align-middle text-center">
        <span class="font-bold text-ink tabular-nums">{item.plannedSize}</span>
        <span class="text-faint text-xs"> чел.</span>
      </td>
      <td class="px-4 py-3 align-middle text-center hidden md:table-cell">
        <div class="flex items-center justify-center gap-1.5 text-xs">
          <Badge variant="accent">{item.trackedCount}</Badge>
          <span class="text-faint">/</span>
          <Badge variant="neutral">{item.autoCount}</Badge>
        </div>
      </td>
      <td class="px-4 py-3 align-middle text-center tabular-nums text-muted hidden md:table-cell">
        {item.completedRuns}
      </td>
      <td class="px-4 py-3 align-middle text-right">
        <Dropdown align="right" width={230}>
          {#snippet trigger()}
            <span
              class="inline-flex p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Icon name="more" size={18} />
            </span>
          {/snippet}
          {#snippet children()}
            {#if item.archived}
              <DropdownItem icon="refresh" onclick={() => restore(item)}>Вернуть из архива</DropdownItem>
            {:else}
              <DropdownItem icon="edit" onclick={() => openEdit(item)}>Изменить</DropdownItem>
              <DropdownItem icon="trendUp" onclick={() => openTransfer(item)}>Перевести класс</DropdownItem>
              <DropdownItem icon="users" onclick={() => (location.href = `/students?classId=${item.id}`)}>
                Ученики класса
              </DropdownItem>
              <div class="my-1 border-t border-line"></div>
              <DropdownItem icon="archive" onclick={() => archive(item)}>В архив</DropdownItem>
            {/if}
            <DropdownItem icon="trash" danger onclick={() => remove(item)}>Удалить</DropdownItem>
          {/snippet}
        </Dropdown>
      </td>
    {/snippet}
  </Table>
{/if}

<Modal bind:open={createOpen} title="Новый класс" subtitle="Номер и буква выбираются из списка" size="md">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <Select
        bind:value={form.number}
        label="Номер"
        placeholder="Класс"
        options={CLASS_NUMBERS.map((n) => ({ value: n, label: `${n} класс` }))}
      />
      <Select
        bind:value={form.letter}
        label="Буква"
        placeholder="Буква"
        options={CLASS_LETTERS.map((l) => ({
          value: l,
          label: takenLetters.has(l) ? `${l} — уже есть` : l,
          disabled: takenLetters.has(l),
        }))}
      />
    </div>
    <Input
      bind:value={form.plannedSize}
      label="Количество учеников"
      type="number"
      min={0}
      max={60}
      icon="users"
      hint="Столько QR-кодов напечатается на класс (плюс запасные)"
    />
    <Input
      bind:value={form.homeroomTeacher}
      label="Классный руководитель"
      icon="user"
      placeholder="Фамилия Имя Отчество"
    />
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (createOpen = false)}>Отмена</Button>
    <Button icon="check" loading={busy} onclick={create}>Создать</Button>
  {/snippet}
</Modal>

<Modal bind:open={editOpen} title="Класс {editing?.name ?? ''}" size="sm">
  <div class="space-y-4">
    <Input bind:value={editForm.plannedSize} label="Количество учеников" type="number" min={0} max={60} icon="users" />
    <Input bind:value={editForm.homeroomTeacher} label="Классный руководитель" icon="user" />
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (editOpen = false)}>Отмена</Button>
    <Button icon="save" loading={busy} onclick={saveEdit}>Сохранить</Button>
  {/snippet}
</Modal>

<Modal bind:open={transferOpen} title="Перевод класса {editing?.name ?? ''}" size="sm">
  <p class="text-sm text-muted mb-4">
    Выберите, каким класс станет. Если такой класс уже есть, ученики перейдут в него, а нынешний уйдёт в архив.
  </p>
  <div class="grid grid-cols-2 gap-4">
    <Select
      bind:value={transferForm.number}
      label="Новый номер"
      options={CLASS_NUMBERS.map((n) => ({ value: n, label: `${n} класс` }))}
    />
    <Select
      bind:value={transferForm.letter}
      label="Новая буква"
      options={CLASS_LETTERS.map((l) => ({ value: l, label: l }))}
    />
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (transferOpen = false)}>Отмена</Button>
    <Button icon="arrowRight" loading={busy} onclick={transfer}>Перевести</Button>
  {/snippet}
</Modal>
