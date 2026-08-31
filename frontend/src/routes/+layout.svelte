<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../app.css'
  import { theme } from '$lib/theme.svelte'

  let { children }: { children?: Snippet } = $props()

  $effect(() => {
    theme.init()
  })
</script>

<svelte:head>
  <title>Психолоджик</title>
</svelte:head>

{@render children?.()}
