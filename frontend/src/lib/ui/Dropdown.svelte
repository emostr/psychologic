<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    align?: 'left' | 'right'
    width?: number
    trigger?: Snippet<[{ open: boolean }]>
    children?: Snippet<[{ close: () => void }]>
  }

  let { align = 'right', width = 220, trigger, children }: Props = $props()

  let open = $state(false)
  let triggerEl = $state<HTMLElement | null>(null)
  let menuEl = $state<HTMLElement | null>(null)
  let pos = $state({ top: 0, left: 0, origin: 'top' as 'top' | 'bottom' })

  function place() {
    if (!triggerEl) {
      return
    }
    const rect = triggerEl.getBoundingClientRect()
    const gap = 6
    const menuHeight = menuEl?.offsetHeight ?? 0
    const below = window.innerHeight - rect.bottom
    // Не хватает места снизу — раскрываемся вверх.
    const flip = below < menuHeight + gap && rect.top > below

    let left = align === 'right' ? rect.right - width : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))

    pos = { top: flip ? rect.top - gap - menuHeight : rect.bottom + gap, left, origin: flip ? 'bottom' : 'top' }
  }

  async function toggle() {
    open = !open
    if (open) {
      await Promise.resolve()
      place()
      requestAnimationFrame(place)
    }
  }

  function close() {
    open = false
  }

  function onDocClick(event: MouseEvent) {
    const target = event.target as Node | null
    if (target && (triggerEl?.contains(target) || menuEl?.contains(target))) {
      return
    }
    close()
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close()
    }
  }
</script>

<svelte:document onclick={onDocClick} onkeydown={onKey} />
<svelte:window onresize={close} onscroll={close} />

<div bind:this={triggerEl} class="inline-block">
  <div
    role="button"
    tabindex="0"
    onclick={toggle}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
  >
    {#if trigger}
      {@render trigger({ open })}
    {:else}
      <span class="p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer inline-flex">
        <Icon name="more" size={18} />
      </span>
    {/if}
  </div>
</div>

{#if open}
  <div
    bind:this={menuEl}
    class="fixed z-[120] bg-surface border border-line shadow-2xl py-1 ng-enter"
    style="top: {pos.top}px; left: {pos.left}px; width: {width}px; transform-origin: {pos.origin}"
  >
    {@render children?.({ close })}
  </div>
{/if}
