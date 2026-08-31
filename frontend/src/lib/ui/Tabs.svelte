<script lang="ts">
  import Icon from './Icon.svelte'

  interface Tab {
    value: string
    label: string
    icon?: string
    badge?: string | number | null
  }

  interface Props {
    value?: string
    tabs?: Tab[]
    class?: string
  }

  let { value = $bindable(''), tabs = [], class: klass = '' }: Props = $props()
</script>

<div class="flex items-stretch gap-1 border-b border-line overflow-x-auto {klass}">
  {#each tabs as tab (tab.value)}
    <button
      type="button"
      class="relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer {value ===
      tab.value
        ? 'text-ink'
        : 'text-muted hover:text-ink'}"
      onclick={() => (value = tab.value)}
    >
      {#if tab.icon}<Icon name={tab.icon} size={16} />{/if}
      {tab.label}
      {#if tab.badge !== null && tab.badge !== undefined}
        <span class="text-[10px] font-bold bg-surface-3 text-muted px-1.5 py-0.5">{tab.badge}</span>
      {/if}
      {#if value === tab.value}
        <span class="absolute left-0 right-0 -bottom-px h-0.5 bg-accent"></span>
      {/if}
    </button>
  {/each}
</div>
