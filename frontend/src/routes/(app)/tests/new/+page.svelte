<script lang="ts">
  import { PageHeader, Button } from '$ui'
  import TestBuilder from '$lib/components/TestBuilder.svelte'
</script>

<svelte:head><title>Новый тест · Психолоджик</title></svelte:head>

<PageHeader title="Новый тест" subtitle="Соберите вопросы и разметьте, что означает каждый диапазон баллов">
  {#snippet actions()}
    <Button variant="ghost" icon="arrowLeft" href="/tests">К списку</Button>
  {/snippet}
</PageHeader>

<TestBuilder />
