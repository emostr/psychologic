<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  type Variant = 'info' | 'success' | 'warning' | 'danger'

  interface Props {
    variant?: Variant
    title?: string
    class?: string
    children?: Snippet
    actions?: Snippet
  }

  let { variant = 'info', title = '', class: klass = '', children, actions }: Props = $props()

  const MAP: Record<Variant, { border: string; icon: string; tint: string }> = {
    info: { border: 'border-l-info', icon: 'info', tint: 'text-info' },
    success: { border: 'border-l-success', icon: 'checkCircle', tint: 'text-success' },
    warning: { border: 'border-l-warning', icon: 'alert', tint: 'text-warning' },
    danger: { border: 'border-l-danger', icon: 'alert', tint: 'text-danger' },
  }

  const conf = $derived(MAP[variant])
</script>

<div class="flex items-start gap-3 bg-surface border border-line border-l-[3px] px-4 py-3 {conf.border} {klass}">
  <span class="shrink-0 mt-0.5 {conf.tint}"><Icon name={conf.icon} size={20} /></span>
  <div class="min-w-0 flex-1">
    {#if title}<p class="font-bold text-ink text-sm">{title}</p>{/if}
    <div class="text-sm text-muted {title ? 'mt-0.5' : ''}">{@render children?.()}</div>
  </div>
  {#if actions}
    <div class="shrink-0 flex items-center gap-2">{@render actions()}</div>
  {/if}
</div>
