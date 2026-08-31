<script lang="ts">
  import { goto } from '$app/navigation'
  import { Icon, Button } from '$ui'
  import { auth } from '$lib/auth.svelte'
  import { api, errorMessage } from '$lib/api'
  import type { Profile } from '$lib/types'

  let pin = $state('')
  let busy = $state(false)
  let error = $state('')
  let field = $state<HTMLInputElement | null>(null)

  $effect(() => {
    field?.focus()
  })

  async function submit(event?: Event) {
    event?.preventDefault()
    if (pin.length < 4) {
      error = 'ПИН-код — минимум 4 цифры'
      return
    }
    busy = true
    error = ''
    try {
      const profile = await api.post<Profile>('/auth/unlock', { pin })
      auth.apply(profile)
      pin = ''
    } catch (e) {
      error = errorMessage(e)
      pin = ''
    } finally {
      busy = false
    }
  }

  async function signOut() {
    await auth.logout()
    await goto('/login')
  }

  function press(digit: string) {
    if (pin.length < 8) {
      pin += digit
      error = ''
    }
  }
</script>

<!-- Оверлей поверх интерфейса: сессия не завершена, просто прикрыта от
     любопытных глаз. Данные под ним не видны. -->
<div class="fixed inset-0 z-[200] bg-bg/98 backdrop-blur-md flex items-center justify-center p-6">
  <div class="w-full max-w-xs ng-enter">
    <div class="flex flex-col items-center text-center mb-8">
      <span class="w-14 h-14 bg-accent text-on-accent flex items-center justify-center mb-4">
        <Icon name="lock" size={26} />
      </span>
      <h2 class="text-xl font-extrabold text-ink">Экран заблокирован</h2>
      <p class="text-sm text-muted mt-1">
        {auth.profile?.fullName ?? ''} · введите ПИН-код, чтобы продолжить
      </p>
    </div>

    <form onsubmit={submit}>
      <input
        bind:this={field}
        bind:value={pin}
        type="password"
        inputmode="numeric"
        autocomplete="off"
        maxlength="8"
        placeholder="••••"
        class="w-full h-14 bg-surface-2 text-ink text-center text-2xl font-bold border outline-none transition-colors {error
          ? 'border-danger'
          : 'border-line focus:border-accent'}"
      />
      {#if error}<p class="text-xs text-danger mt-2 text-center">{error}</p>{/if}

      <div class="grid grid-cols-3 gap-2 mt-4">
        {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit (digit)}
          <button
            type="button"
            class="h-12 bg-surface border border-line hover:border-accent text-ink font-bold text-lg ng-tile-press cursor-pointer"
            onclick={() => press(digit)}
          >
            {digit}
          </button>
        {/each}
        <button
          type="button"
          aria-label="Стереть"
          class="h-12 bg-surface border border-line hover:border-danger text-muted hover:text-danger flex items-center justify-center ng-tile-press cursor-pointer"
          onclick={() => (pin = pin.slice(0, -1))}
        >
          <Icon name="arrowLeft" size={18} />
        </button>
        <button
          type="button"
          class="h-12 bg-surface border border-line hover:border-accent text-ink font-bold text-lg ng-tile-press cursor-pointer"
          onclick={() => press('0')}
        >
          0
        </button>
        <button
          type="submit"
          aria-label="Разблокировать"
          class="h-12 bg-accent text-on-accent flex items-center justify-center ng-tile-press cursor-pointer disabled:opacity-50"
          disabled={busy}
        >
          <Icon name={busy ? 'refresh' : 'check'} size={20} class={busy ? 'animate-spin' : ''} />
        </button>
      </div>
    </form>

    <div class="mt-6 text-center">
      <Button variant="ghost" size="sm" icon="logout" onclick={signOut}>Выйти из системы</Button>
    </div>
  </div>
</div>
