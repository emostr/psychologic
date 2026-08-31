<script lang="ts">
  import Icon from './Icon.svelte'

  interface Option {
    value: string | number
    label: string
    disabled?: boolean
  }

  interface Props {
    value?: string | number
    label?: string
    options?: Array<Option | string | number>
    placeholder?: string
    hint?: string
    disabled?: boolean
    allowEmpty?: boolean
    class?: string
    onchange?: (value: string) => void
  }

  let {
    value = $bindable(''),
    label = '',
    options = [],
    placeholder = 'Выберите…',
    hint = '',
    disabled = false,
    allowEmpty = false,
    class: klass = '',
    onchange,
  }: Props = $props()

  const uid = $props.id()

  const normalized = $derived(
    options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) })) as Option[],
  )

  function handle(event: Event) {
    value = (event.target as HTMLSelectElement).value
    onchange?.(String(value))
  }
</script>

<div class={klass}>
  {#if label}<label for={uid} class="ng-label text-muted block mb-1.5">{label}</label>{/if}
  <div class="relative">
    <select
      id={uid}
      {disabled}
      value={String(value ?? '')}
      class="w-full h-11 bg-surface-2 text-ink text-sm border border-line focus:border-accent outline-none px-3 pr-9 appearance-none cursor-pointer transition-colors disabled:opacity-50"
      onchange={handle}
    >
      <option value="" disabled={!allowEmpty}>{placeholder}</option>
      {#each normalized as option (option.value)}
        <option value={String(option.value)} disabled={option.disabled}>{option.label}</option>
      {/each}
    </select>
    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
      <Icon name="chevronDown" size={16} />
    </span>
  </div>
  {#if hint}<p class="text-xs text-faint mt-1.5">{hint}</p>{/if}
</div>
