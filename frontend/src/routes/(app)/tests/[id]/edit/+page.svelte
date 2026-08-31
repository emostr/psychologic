<script lang="ts">
  import { page } from '$app/state'
  import { PageHeader, Button, Alert, Skeleton } from '$ui'
  import TestBuilder from '$lib/components/TestBuilder.svelte'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import type { TestView } from '$lib/types'

  let test = $state<TestView | null>(null)
  let error = $state('')

  $effect(() => {
    const id = page.params.id
    void api
      .get<TestView>(`/tests/${id}`)
      .then((value) => {
        test = value
      })
      .catch((e) => {
        error = errorMessage(e)
        notify.error('Не удалось открыть тест', { text: error })
      })
  })
</script>

<svelte:head><title>Правка теста · Психолоджик</title></svelte:head>

<PageHeader title="Правка теста" subtitle={test?.title ?? ''}>
  {#snippet actions()}
    <Button variant="ghost" icon="arrowLeft" href="/tests/{page.params.id}">Назад</Button>
  {/snippet}
</PageHeader>

{#if error}
  <Alert variant="danger" title="Ошибка">{error}</Alert>
{:else if test}
  {#if test.isBuiltIn}
    <Alert variant="warning" title="Встроенную методику нельзя изменить" class="mb-6">
      Чтобы подстроить её под школу, сделайте копию — она станет обычным вашим тестом.
    </Alert>
  {:else}
    {#if test.runCount > 0}
      <Alert variant="warning" title="По тесту уже есть результаты" class="mb-6">
        {test.runCount} прохождений. Правка вопросов и баллов не пересчитывает уже сохранённые результаты — их
        станет невозможно сравнивать с новыми. Для существенных изменений лучше сделать копию.
      </Alert>
    {/if}
    <TestBuilder source={test} />
  {/if}
{:else}
  <div class="bg-surface border border-line p-6"><Skeleton rows={6} /></div>
{/if}
