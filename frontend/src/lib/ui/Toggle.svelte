<script lang="ts">
  interface Props {
    checked?: boolean
    label?: string
    hint?: string
    disabled?: boolean
  }

  let { checked = $bindable(false), label = '', hint = '', disabled = false }: Props = $props()

  function toggle() {
    if (!disabled) {
      checked = !checked
    }
  }
</script>

<button
  type="button"
  {disabled}
  onclick={toggle}
  class="flex w-full items-start gap-3 select-none text-left {disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer'}"
>
  <span
    class="relative inline-flex items-center w-12 h-6 px-1 border transition-colors duration-150 shrink-0 mt-0.5 {checked
      ? 'bg-accent border-accent'
      : 'bg-surface-2 border-line-strong'}"
  >
    <span
      class="w-4 h-4 transition-transform duration-200 ease-out {checked
        ? 'translate-x-6 bg-on-accent'
        : 'translate-x-0 bg-muted'}"
    ></span>
  </span>
  <span class="min-w-0">
    {#if label}<span class="block text-sm text-ink">{label}</span>{/if}
    {#if hint}<span class="block text-xs text-faint mt-0.5">{hint}</span>{/if}
  </span>
</button>
