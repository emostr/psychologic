<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    value?: string | number
    label?: string
    type?: string
    placeholder?: string
    hint?: string
    error?: string
    icon?: string
    disabled?: boolean
    required?: boolean
    autofocus?: boolean
    maxlength?: number
    min?: number
    max?: number
    inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'search' | 'email' | 'url'
    autocomplete?: string
    class?: string
    oninput?: (event: Event) => void
    onkeydown?: (event: KeyboardEvent) => void
  }

  let {
    value = $bindable(''),
    label = '',
    type = 'text',
    placeholder = '',
    hint = '',
    error = '',
    icon = '',
    disabled = false,
    required = false,
    autofocus = false,
    maxlength,
    min,
    max,
    inputmode,
    autocomplete,
    class: klass = '',
    oninput,
    onkeydown,
  }: Props = $props()

  const uid = $props.id()

  const fieldClass = $derived(
    [
      'w-full h-11 bg-surface-2 text-ink text-sm border transition-colors',
      'placeholder:text-faint outline-none',
      icon ? 'pl-10 pr-3' : 'px-3',
      error ? 'border-danger focus:border-danger' : 'border-line focus:border-accent',
      disabled ? 'opacity-50 pointer-events-none' : '',
    ].join(' '),
  )

  function handle(event: Event) {
    const target = event.target as HTMLInputElement
    value = type === 'number' ? (target.value === '' ? '' : Number(target.value)) : target.value
    oninput?.(event)
  }
</script>

<div class={klass}>
  {#if label}
    <label for={uid} class="ng-label text-muted block mb-1.5">
      {label}{#if required}<span class="text-accent"> *</span>{/if}
    </label>
  {/if}
  <div class="relative">
    {#if icon}
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
        <Icon name={icon} size={17} />
      </span>
    {/if}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      id={uid}
      {type}
      {placeholder}
      {disabled}
      {autofocus}
      {maxlength}
      {min}
      {max}
      {inputmode}
      {autocomplete}
      value={value ?? ''}
      class={fieldClass}
      oninput={handle}
      {onkeydown}
    />
  </div>
  {#if error}
    <p class="text-xs text-danger mt-1.5">{error}</p>
  {:else if hint}
    <p class="text-xs text-faint mt-1.5">{hint}</p>
  {/if}
</div>
