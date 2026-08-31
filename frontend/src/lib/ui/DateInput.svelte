<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    value?: string
    label?: string
    type?: 'date' | 'datetime-local' | 'month'
    hint?: string
    disabled?: boolean
    min?: string
    max?: string
    class?: string
  }

  let {
    value = $bindable(''),
    label = '',
    type = 'date',
    hint = '',
    disabled = false,
    min,
    max,
    class: klass = '',
  }: Props = $props()

  const uid = $props.id()
  let field = $state<HTMLInputElement | null>(null)

  function openPicker() {
    try {
      field?.showPicker?.()
    } catch {
      /* Safari не умеет showPicker — там сработает нативный клик по полю */
    }
  }
</script>

<div class={klass}>
  {#if label}<label for={uid} class="ng-label text-muted block mb-1.5">{label}</label>{/if}
  <div class="relative group">
    <input
      id={uid}
      bind:this={field}
      {type}
      {disabled}
      {min}
      {max}
      bind:value
      class="ng-date w-full h-11 bg-surface-2 text-ink text-sm border border-line focus:border-accent outline-none pl-3 pr-10 transition-colors disabled:opacity-50 cursor-pointer"
    />
    <button
      type="button"
      tabindex="-1"
      aria-label="Открыть календарь"
      class="absolute right-0 top-0 h-11 w-10 flex items-center justify-center text-muted group-focus-within:text-accent hover:text-accent transition-colors cursor-pointer"
      onclick={openPicker}
    >
      <Icon name="calendar" size={17} />
    </button>
  </div>
  {#if hint}<p class="text-xs text-faint mt-1.5">{hint}</p>{/if}
</div>

<style>
  .ng-date::-webkit-calendar-picker-indicator {
    opacity: 0;
    position: absolute;
    right: 0;
    width: 2.5rem;
    height: 100%;
    cursor: pointer;
  }
  .ng-date::-webkit-datetime-edit {
    padding: 0;
  }
</style>
