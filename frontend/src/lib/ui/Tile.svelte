<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    label?: string
    value?: string | number
    icon?: string
    hint?: string
    solid?: boolean
    href?: string
    onclick?: () => void
  }

  let { label = '', value = '', icon = '', hint = '', solid = false, href = '', onclick }: Props = $props()

  const classes = $derived(
    [
      'relative overflow-hidden ng-tile-press border p-5 flex flex-col justify-between min-h-[128px] text-left w-full',
      solid ? 'bg-accent text-on-accent border-transparent' : 'bg-surface border-line hover:border-line-strong',
      href || onclick ? 'cursor-pointer' : '',
    ].join(' '),
  )
</script>

{#snippet inner()}
  <div class="flex items-start justify-between gap-2">
    <span class="ng-label {solid ? 'text-on-accent/80' : 'text-muted'}">{label}</span>
    {#if icon}
      <Icon name={icon} size={22} class={solid ? 'text-on-accent/70' : 'text-accent'} />
    {/if}
  </div>
  <div>
    <div class="text-3xl font-extrabold tracking-normal leading-none">{value}</div>
    {#if hint}
      <div class="mt-2 text-xs {solid ? 'text-on-accent/70' : 'text-faint'}">{hint}</div>
    {/if}
  </div>
{/snippet}

{#if href}
  <a {href} class={classes}>{@render inner()}</a>
{:else if onclick}
  <button type="button" class={classes} {onclick}>{@render inner()}</button>
{:else}
  <div class={classes}>{@render inner()}</div>
{/if}
