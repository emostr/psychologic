<script lang="ts">
  import { page } from '$app/state'
  import { PageHeader, Card, Badge, Button, Table, Alert, Skeleton, EmptyState, Icon } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { QUESTION_TYPE_LABELS } from '$lib/catalog'
  import { formatDate } from '$lib/format'
  import type { TestView } from '$lib/types'

  let test = $state<TestView | null>(null)
  let error = $state('')

  $effect(() => {
    void reload(page.params.id!)
  })

  async function reload(id: string) {
    try {
      test = await api.get<TestView>(`/tests/${id}`)
    } catch (e) {
      error = errorMessage(e)
    }
  }

  async function duplicate() {
    if (!test) {
      return
    }
    try {
      const copy = await api.post<TestView>(`/tests/${test.id}/duplicate`, {})
      notify.toast('Копия создана')
      location.href = `/tests/${copy.id}/edit`
    } catch (e) {
      notify.error('Не удалось скопировать', { text: errorMessage(e) })
    }
  }

  async function togglePublish() {
    if (!test) {
      return
    }
    try {
      test = await api.post<TestView>(`/tests/${test.id}/${test.isPublished ? 'unpublish' : 'publish'}`)
      notify.toast(test.isPublished ? 'Тест опубликован' : 'Тест снят с публикации')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>{test?.title ?? 'Тест'} · Психолоджик</title></svelte:head>

{#if error}
  <Alert variant="danger" title="Ошибка">{error}</Alert>
{:else if test}
  <PageHeader title={test.title} subtitle={test.description}>
    {#snippet actions()}
      <Button variant="ghost" icon="arrowLeft" href="/tests">К списку</Button>
      {#if !test.isBuiltIn}
        <Button variant="secondary" icon="edit" href="/tests/{test.id}/edit">Редактировать</Button>
      {/if}
      <Button variant="secondary" icon="copy" onclick={duplicate}>Копия</Button>
      {#if test.isPublished}
        <Button icon="qr" href="/campaigns?testId={test.id}">Выдать классам</Button>
      {:else}
        <Button icon="send" onclick={togglePublish}>Опубликовать</Button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="flex flex-wrap items-center gap-2 mb-6">
    {#if test.isBuiltIn}<Badge variant="info">Встроенная методика</Badge>{/if}
    <Badge variant={test.isPublished ? 'success' : 'neutral'} dot>
      {test.isPublished ? 'Опубликован' : 'Черновик'}
    </Badge>
    <Badge variant="neutral">{test.questionCount} вопросов</Badge>
    <Badge variant="neutral">максимум {test.maxScore}</Badge>
    <Badge variant="neutral">{test.runCount} прохождений</Badge>
    {#if test.showResult}<Badge variant="accent">результат виден ученику</Badge>{/if}
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
    <div class="xl:col-span-2 space-y-6">
      {#if test.instructions}
        <Card title="Инструкция для ученика" accent>
          <p class="text-sm text-ink whitespace-pre-wrap">{test.instructions}</p>
        </Card>
      {/if}

      <Card title="Вопросы" padding={false}>
        <ol class="divide-y divide-line">
          {#each test.questions as question, index (question.id)}
            <li class="p-5">
              <div class="flex items-start gap-3">
                <span class="w-7 h-7 shrink-0 bg-surface-3 text-muted flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-ink font-medium">{question.text}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                    {#if question.options.reverse}<Badge variant="warning">обратный</Badge>{/if}
                  </div>
                  {#if question.options.choices?.length}
                    <ul class="mt-3 space-y-1">
                      {#each question.options.choices as choice (choice.text)}
                        <li class="flex items-center justify-between gap-3 text-sm border-b border-line/60 py-1">
                          <span class="text-muted">{choice.text}</span>
                          <span class="text-faint tabular-nums text-xs">{choice.score} б.</span>
                        </li>
                      {/each}
                    </ul>
                  {:else if question.type === 'SCALE'}
                    <p class="text-xs text-faint mt-2">
                      Шкала от {question.options.min} ({question.options.minLabel || '—'}) до
                      {question.options.max} ({question.options.maxLabel || '—'})
                    </p>
                  {/if}
                </div>
              </div>
            </li>
          {/each}
        </ol>
      </Card>
    </div>

    <div class="space-y-6">
      <Card title="Интерпретация" padding={false}>
        {#if test.interpretations.length}
          <Table
            columns={[
              { key: 'range', label: 'Баллы', width: '90px' },
              { key: 'level', label: 'Уровень' },
            ]}
            rows={test.interpretations}
            class="border-0"
          >
            {#snippet row(item)}
              <td class="px-4 py-3 align-top tabular-nums text-muted text-xs">
                {item.minScore}–{item.maxScore}
              </td>
              <td class="px-4 py-3 align-top">
                <Badge variant={item.color}>{item.label}</Badge>
                {#if item.text}<p class="text-xs text-muted mt-1.5">{item.text}</p>{/if}
              </td>
            {/snippet}
          </Table>
        {:else}
          <EmptyState icon="sliders" title="Уровни не заданы" description="Результат останется просто числом." />
        {/if}
      </Card>

      <Card title="Сведения">
        <dl class="divide-y divide-line text-sm">
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Автор</dt>
            <dd class="text-ink">{test.authorName ?? 'Платформа'}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Создан</dt>
            <dd class="text-ink">{formatDate(test.createdAt)}</dd>
          </div>
          <div class="flex justify-between gap-4 py-2.5">
            <dt class="text-muted">Изменён</dt>
            <dd class="text-ink">{formatDate(test.updatedAt)}</dd>
          </div>
        </dl>
        {#snippet footer()}
          <a
            href="/analytics?testId={test?.id}"
            class="flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <Icon name="barChart" size={15} /> Аналитика по этой методике
          </a>
        {/snippet}
      </Card>
    </div>
  </div>
{:else}
  <div class="bg-surface border border-line p-6"><Skeleton rows={6} /></div>
{/if}
