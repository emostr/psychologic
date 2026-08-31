<script lang="ts">
  import { goto } from '$app/navigation'
  import { Icon, Dropdown, DropdownItem, Avatar } from '$ui'
  import { theme } from '$lib/theme.svelte'
  import { auth } from '$lib/auth.svelte'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'

  interface Props {
    ontoggle?: () => void
  }

  let { ontoggle }: Props = $props()

  async function lockNow() {
    if (!auth.profile?.hasPin) {
      notify.warning('Сначала задайте ПИН-код в настройках')
      return
    }
    try {
      await api.post('/auth/lock')
      auth.locked = true
    } catch (e) {
      notify.error('Не удалось заблокировать', { text: errorMessage(e) })
    }
  }

  async function doLogout() {
    const ok = await notify.confirm({
      title: 'Выйти из системы?',
      text: 'Придётся вводить логин, пароль и код подтверждения заново.',
      confirmText: 'Выйти',
      danger: true,
    })
    if (!ok) {
      return
    }
    await auth.logout()
    await goto('/login')
  }
</script>

<header
  class="sticky top-0 z-30 h-16 bg-bg/85 backdrop-blur border-b border-line flex items-center gap-3 px-4 sm:px-6"
>
  <button
    type="button"
    aria-label="Меню"
    class="lg:hidden h-9 w-9 flex items-center justify-center text-muted hover:text-ink cursor-pointer"
    onclick={ontoggle}
  >
    <Icon name="menu" size={22} />
  </button>

  <div class="flex-1"></div>

  {#if auth.isPsychologist}
    <button
      type="button"
      title="Заблокировать экран"
      class="h-9 w-9 flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
      onclick={lockNow}
    >
      <Icon name="lock" size={18} />
    </button>
  {/if}

  <button
    type="button"
    title={theme.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    class="h-9 w-9 flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
    onclick={() => theme.toggleTheme()}
  >
    <Icon name={theme.theme === 'dark' ? 'sun' : 'moon'} size={19} />
  </button>

  <div class="w-px h-6 bg-line mx-1 hidden sm:block"></div>

  <Dropdown align="right" width={240}>
    {#snippet trigger()}
      <span class="flex items-center gap-2 pl-1 pr-2 h-9 hover:bg-surface-2 transition-colors cursor-pointer">
        <Avatar name={auth.profile?.fullName ?? ''} size={30} />
        <span class="text-faint hidden sm:block"><Icon name="chevronDown" size={15} /></span>
      </span>
    {/snippet}
    {#snippet children()}
      <div class="px-3.5 py-2.5 border-b border-line">
        <div class="text-sm font-bold text-ink truncate">{auth.profile?.fullName}</div>
        <div class="text-xs text-muted">@{auth.profile?.login}</div>
      </div>
      <DropdownItem icon="settings" onclick={() => goto(auth.isAdmin ? '/admin/security' : '/settings')}>
        Настройки
      </DropdownItem>
      <div class="my-1 border-t border-line"></div>
      <DropdownItem icon="logout" danger onclick={doLogout}>Выйти</DropdownItem>
    {/snippet}
  </Dropdown>
</header>
