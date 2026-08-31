<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    icon?: string
    danger?: boolean
    disabled?: boolean
    onclick?: () => void
    children?: Snippet
  }

  let { icon = '', danger = false, disabled = false, onclick, children }: Props = $props()
</script>

<button
  type="button"
  {disabled}
  {onclick}
  class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed {danger
    ? 'text-danger hover:bg-danger/10'
    : 'text-ink hover:bg-surface-2'}"
>
  {#if icon}<span class={danger ? '' : 'text-muted'}><Icon name={icon} size={16} /></span>{/if}
  {@render children?.()}
</button>
