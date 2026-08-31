<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    checked?: boolean
    label?: string
    disabled?: boolean
    class?: string
  }

  let { checked = $bindable(false), label = '', disabled = false, class: klass = '' }: Props = $props()

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
  class="flex w-fit items-center gap-2.5 select-none text-left {disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer'} {klass}"
>
  <span
    class="w-5 h-5 border flex items-center justify-center transition-colors shrink-0 {checked
      ? 'bg-accent border-accent text-on-accent'
      : 'bg-surface-2 border-line-strong'}"
  >
    {#if checked}<Icon name="check" size={14} stroke={3} />{/if}
  </span>
  {#if label}<span class="text-sm text-ink">{label}</span>{/if}
</button>
