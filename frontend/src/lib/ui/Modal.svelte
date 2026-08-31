<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  import { portal } from './portal'

  type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full'

  interface Props {
    open?: boolean
    title?: string
    subtitle?: string
    size?: Size
    closable?: boolean
    header?: Snippet
    footer?: Snippet
    children?: Snippet
    onclose?: () => void
  }

  let {
    open = $bindable(false),
    title = '',
    subtitle = '',
    size = 'md',
    closable = true,
    header,
    footer,
    children,
    onclose,
  }: Props = $props()

  const SIZES: Record<Size, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  function close() {
    if (!closable) {
      return
    }
    open = false
    onclose?.()
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close()
    }
  }

  // Фон под модалкой не должен прокручиваться вместе с ней.
  $effect(() => {
    if (typeof document === 'undefined') {
      return
    }
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  })
</script>

<svelte:window {onkeydown} />

{#if open}
  <div use:portal class="fixed inset-0 z-100 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
    <button
      type="button"
      aria-label="Закрыть"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] cursor-default"
      onclick={close}
    ></button>
    <div
      class="relative w-full bg-surface border border-line border-l-[3px] border-l-accent shadow-2xl mt-4 sm:mt-12 ng-enter {SIZES[
        size
      ]}"
      role="dialog"
      aria-modal="true"
    >
      <header class="flex items-start justify-between gap-4 px-6 py-4 border-b border-line">
        <div class="min-w-0">
          {#if header}
            {@render header()}
          {:else}
            <h3 class="text-lg font-bold text-ink truncate">{title}</h3>
            {#if subtitle}<p class="text-sm text-muted mt-0.5">{subtitle}</p>{/if}
          {/if}
        </div>
        {#if closable}
          <button
            type="button"
            aria-label="Закрыть"
            class="shrink-0 -mr-1 p-1 text-muted hover:text-danger transition-colors cursor-pointer"
            onclick={close}
          >
            <Icon name="close" size={20} />
          </button>
        {/if}
      </header>

      <div class="px-6 py-5">
        {@render children?.()}
      </div>

      {#if footer}
        <footer
          class="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-line bg-surface-2/40"
        >
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}
