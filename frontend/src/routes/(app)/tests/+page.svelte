<script lang="ts">
  import {
    PageHeader,
    Card,
    Badge,
    Button,
    Tabs,
    EmptyState,
    Dropdown,
    DropdownItem,
    Input,
    Icon,
  } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { countLabel, formatDate } from '$lib/format'
  import type { TestSummary } from '$lib/types'

  let rows = $state<TestSummary[]>([])
  let loading = $state(true)
  let tab = $state('all')
  let search = $state('')

  const visible = $derived.by(() => {
    let list = rows
    if (tab === 'builtin') {
      list = list.filter((r) => r.isBuiltIn)
    } else if (tab === 'mine') {
      list = list.filter((r) => !r.isBuiltIn)
    } else if (tab === 'drafts') {
      list = list.filter((r) => !r.isPublished)
    }
    const needle = search.trim().toLowerCase()
    return needle ? list.filter((r) => r.title.toLowerCase().includes(needle)) : list
  })

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    try {
      rows = await api.get<TestSummary[]>('/tests')
    } catch (e) {
      notify.error('Не удалось загрузить тесты', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  async function duplicate(test: TestSummary) {
    try {
      const copy = await api.post<TestSummary>(`/tests/${test.id}/duplicate`, {})
      notify.toast('Копия создана')
      location.href = `/tests/${copy.id}/edit`
    } catch (e) {
      notify.error('Не удалось скопировать', { text: errorMessage(e) })
    }
  }

  async function togglePublish(test: TestSummary) {
    try {
      await api.post(`/tests/${test.id}/${test.isPublished ? 'unpublish' : 'publish'}`)
      await load()
      notify.toast(test.isPublished ? 'Тест снят с публикации' : 'Тест опубликован')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function remove(test: TestSummary) {
    const ok = await notify.confirm({
      title: `Удалить «${test.title}»?`,
      text: test.runCount
        ? `По этому тесту есть ${countLabel(test.runCount, 'результат', 'результата', 'результатов')} — они останутся в базе, но тест исчезнет из списка и его больше нельзя будет выдать.`
        : 'Тест исчезнет из списка.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/tests/${test.id}`)
      await load()
      notify.toast('Тест удалён')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>Тесты · Психолоджик</title></svelte:head>

<PageHeader title="Тесты" subtitle="Встроенные методики и ваши собственные опросники">
  {#snippet actions()}
    <Button icon="plus" href="/tests/new">Создать тест</Button>
  {/snippet}
</PageHeader>

<Tabs
  bind:value={tab}
  tabs={[
    { value: 'all', label: 'Все', badge: rows.length },
    { value: 'builtin', label: 'Встроенные', badge: rows.filter((r) => r.isBuiltIn).length },
    { value: 'mine', label: 'Мои', badge: rows.filter((r) => !r.isBuiltIn).length },
    { value: 'drafts', label: 'Черновики', badge: rows.filter((r) => !r.isPublished).length },
  ]}
  class="mb-4"
/>

<Input bind:value={search} placeholder="Поиск по названию…" icon="search" class="mb-6 max-w-md" />

{#if !loading && !visible.length}
  <Card padding={false}>
    <EmptyState
      icon="clipboard"
      title="Тестов нет"
      description="Соберите свой опросник в конструкторе или скопируйте встроенную методику и подправьте под школу."
    >
      {#snippet actions()}
        <Button icon="plus" href="/tests/new">Создать тест</Button>
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {#each visible as test (test.id)}
      <article
        class="bg-surface border border-line hover:border-line-strong transition-colors flex flex-col {test.isPublished
          ? ''
          : 'border-dashed'}"
      >
        <div class="p-5 flex-1">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex flex-wrap gap-1.5">
              {#if test.isBuiltIn}
                <Badge variant="info">Встроенная</Badge>
              {/if}
              <Badge variant={test.isPublished ? 'success' : 'neutral'} dot>
                {test.isPublished ? 'Опубликован' : 'Черновик'}
              </Badge>
            </div>
            <Dropdown align="right" width={230}>
              {#snippet trigger()}
                <span class="inline-flex p-1 text-muted hover:text-ink transition-colors cursor-pointer">
                  <Icon name="more" size={18} />
                </span>
              {/snippet}
              {#snippet children()}
                <DropdownItem icon="eye" onclick={() => (location.href = `/tests/${test.id}`)}>
                  Открыть
                </DropdownItem>
                {#if !test.isBuiltIn}
                  <DropdownItem icon="edit" onclick={() => (location.href = `/tests/${test.id}/edit`)}>
                    Редактировать
                  </DropdownItem>
                {/if}
                <DropdownItem icon="copy" onclick={() => duplicate(test)}>Сделать копию</DropdownItem>
                <DropdownItem icon={test.isPublished ? 'slash' : 'send'} onclick={() => togglePublish(test)}>
                  {test.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                </DropdownItem>
                {#if test.isPublished}
                  <div class="my-1 border-t border-line"></div>
                  <DropdownItem icon="qr" onclick={() => (location.href = `/campaigns?testId=${test.id}`)}>
                    Выдать классам
                  </DropdownItem>
                {/if}
                {#if !test.isBuiltIn}
                  <div class="my-1 border-t border-line"></div>
                  <DropdownItem icon="trash" danger onclick={() => remove(test)}>Удалить</DropdownItem>
                {/if}
              {/snippet}
            </Dropdown>
          </div>

          <a href="/tests/{test.id}" class="block group">
            <h3 class="text-base font-bold text-ink group-hover:text-accent transition-colors leading-snug">
              {test.title}
            </h3>
          </a>
          {#if test.description}
            <p class="text-sm text-muted mt-2 line-clamp-3">{test.description}</p>
          {/if}
        </div>

        <div class="px-5 py-3 border-t border-line bg-surface-2/40 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 text-xs text-faint">
            <span class="flex items-center gap-1"><Icon name="list" size={13} /> {test.questionCount}</span>
            <span class="flex items-center gap-1"><Icon name="target" size={13} /> {test.maxScore}</span>
            <span class="flex items-center gap-1"><Icon name="users" size={13} /> {test.runCount}</span>
          </div>
          <span class="text-[11px] text-faint">{formatDate(test.updatedAt)}</span>
        </div>
      </article>
    {/each}
  </div>
{/if}
