<script lang="ts">
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { auth } from '$lib/auth.svelte'
  import { setLockHandler } from '$lib/api'
  import Sidebar from '$lib/components/Sidebar.svelte'
  import Topbar from '$lib/components/Topbar.svelte'
  import PinLock from '$lib/components/PinLock.svelte'
  import PoweredBy from '$lib/components/PoweredBy.svelte'

  let { children }: { children?: Snippet } = $props()

  let sidebarOpen = $state(false)
  let allowed = $state(false)

  // Любой ответ 423 из API поднимает оверлей ввода ПИН-кода.
  $effect(() => {
    setLockHandler(() => {
      auth.locked = true
    })
    return () => setLockHandler(null)
  })

  $effect(() => {
    // Путь читаем синхронно: иначе зависимость не отследится и переход
    // психолога на /admin вручную останется без проверки.
    const isAdminArea = page.url.pathname.startsWith('/admin')
    void auth.ensure().then((profile) => {
      if (!profile) {
        return goto('/login', { replaceState: true })
      }
      if (profile.setupStep !== 'done') {
        return goto('/setup', { replaceState: true })
      }
      if (profile.role === 'ADMIN' && !isAdminArea) {
        return goto('/admin', { replaceState: true })
      }
      if (profile.role === 'PSYCHOLOGIST' && isAdminArea) {
        return goto('/dashboard', { replaceState: true })
      }
      allowed = true
      return undefined
    })
  })

  // Смена маршрута закрывает выдвижное меню на телефоне.
  $effect(() => {
    void page.url.pathname
    sidebarOpen = false
  })
</script>

{#if allowed}
  <div class="min-h-screen flex bg-bg">
    {#if sidebarOpen}
      <button
        type="button"
        aria-label="Закрыть меню"
        class="fixed inset-0 z-30 bg-black/60 lg:hidden cursor-default"
        onclick={() => (sidebarOpen = false)}
      ></button>
    {/if}

    <Sidebar open={sidebarOpen} onclose={() => (sidebarOpen = false)} />

    <div class="flex-1 min-w-0 flex flex-col">
      <Topbar ontoggle={() => (sidebarOpen = !sidebarOpen)} />

      <main class="flex-1 p-4 sm:p-6 lg:p-8">
        {@render children?.()}
      </main>

      <footer
        class="border-t border-line px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <p class="text-xs text-faint">Психолоджик · кабинет школьного психолога</p>
        <PoweredBy />
      </footer>
    </div>
  </div>

  {#if auth.locked}
    <PinLock />
  {/if}
{:else}
  <div class="min-h-screen flex items-center justify-center bg-bg">
    <div class="w-10 h-1 bg-accent animate-pulse"></div>
  </div>
{/if}
