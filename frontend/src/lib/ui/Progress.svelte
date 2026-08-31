<script lang="ts">
  type Variant = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

  interface Props {
    value?: number
    max?: number
    variant?: string
    label?: string
    showValue?: boolean
    class?: string
  }

  let { value = 0, max = 100, variant = 'accent', label = '', showValue = false, class: klass = '' }: Props =
    $props()

  const COLORS: Record<Variant, string> = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-muted',
  }

  const pct = $derived(Math.max(0, Math.min(100, max ? (value / max) * 100 : 0)))
  const color = $derived(COLORS[(variant in COLORS ? variant : 'accent') as Variant])
</script>

<div class={klass}>
  {#if label || showValue}
    <div class="flex items-center justify-between gap-2 mb-1.5">
      {#if label}<span class="text-xs font-semibold text-muted truncate">{label}</span>{/if}
      {#if showValue}<span class="text-xs font-bold text-ink tabular-nums">{Math.round(pct)}%</span>{/if}
    </div>
  {/if}
  <div class="h-2 w-full bg-surface-3 overflow-hidden">
    <div class="h-full transition-[width] duration-500 ease-out {color}" style="width: {pct}%"></div>
  </div>
</div>
