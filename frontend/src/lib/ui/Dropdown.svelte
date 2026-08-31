<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  import { portal } from './portal'

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

  function toggle() {
    open = !open
  }

  function close() {
    open = false
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close()
    }
  }

  // Позиционируем после того, как меню появилось в DOM и получило высоту.
  $effect(() => {
    if (!open || !menuEl) {
      return
    }
    place()
    const frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  })
</script>

<svelte:window onkeydown={onKey} onresize={close} onscroll={close} />

<button
  bind:this={triggerEl}
  type="button"
  class="inline-block cursor-pointer text-left"
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={toggle}
>
  {#if trigger}
    {@render trigger({ open })}
  {:else}
    <span class="p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer inline-flex">
      <Icon name="more" size={18} />
    </span>
  {/if}
</button>

{#if open}
  <!--
    Прозрачная подложка вместо слушателя на document. Клик мимо меню
    гарантированно закрывает его в любом браузере, и порядок всплытия событий
    больше ни на что не влияет: раньше клик, открывший меню, доходил до
    document и мог тут же его закрыть. Подложка накрывает и сам триггер,
    поэтому повторный клик по нему просто закрывает меню.
  -->
  <button
    use:portal
    type="button"
    aria-label="Закрыть меню"
    class="fixed inset-0 z-[110] cursor-default"
    onclick={close}
  ></button>
  <div
    use:portal
    bind:this={menuEl}
    role="menu"
    tabindex="-1"
    class="fixed z-[120] bg-surface border border-line shadow-2xl py-1 ng-enter"
    style="top: {pos.top}px; left: {pos.left}px; width: {width}px; transform-origin: {pos.origin}"
  >
    {@render children?.({ close })}
  </div>
{/if}
