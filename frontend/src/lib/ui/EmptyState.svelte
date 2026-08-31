<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    icon?: string
    title: string
    description?: string
    actions?: Snippet
  }

  let { icon = 'box', title, description = '', actions }: Props = $props()
</script>

<div class="flex flex-col items-center justify-center text-center py-14 px-6">
  <span class="w-14 h-14 bg-surface-2 border border-line flex items-center justify-center text-faint mb-4">
    <Icon name={icon} size={26} />
  </span>
  <h3 class="text-base font-bold text-ink">{title}</h3>
  {#if description}<p class="text-sm text-muted mt-1 max-w-md">{description}</p>{/if}
  {#if actions}<div class="mt-5 flex flex-wrap items-center justify-center gap-2">{@render actions()}</div>{/if}
</div>
