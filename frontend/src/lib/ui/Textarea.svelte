<script lang="ts">
  interface Props {
    value?: string
    label?: string
    placeholder?: string
    hint?: string
    error?: string
    rows?: number
    disabled?: boolean
    maxlength?: number
    class?: string
  }

  let {
    value = $bindable(''),
    label = '',
    placeholder = '',
    hint = '',
    error = '',
    rows = 4,
    disabled = false,
    maxlength,
    class: klass = '',
  }: Props = $props()

  const uid = $props.id()

  const fieldClass = $derived(
    [
      'w-full bg-surface-2 text-ink text-sm border px-3 py-2.5 resize-y transition-colors',
      'placeholder:text-faint outline-none',
      error ? 'border-danger focus:border-danger' : 'border-line focus:border-accent',
      disabled ? 'opacity-50 pointer-events-none' : '',
    ].join(' '),
  )
</script>

<div class={klass}>
  {#if label}<label for={uid} class="ng-label text-muted block mb-1.5">{label}</label>{/if}
  <textarea id={uid} {rows} {placeholder} {disabled} {maxlength} class={fieldClass} bind:value></textarea>
  {#if error}
    <p class="text-xs text-danger mt-1.5">{error}</p>
  {:else if hint}
    <p class="text-xs text-faint mt-1.5">{hint}</p>
  {/if}
</div>
