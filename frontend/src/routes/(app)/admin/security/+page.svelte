<script lang="ts">
  import { PageHeader, Card, Input, Button, Alert, Icon, Table, Badge, Avatar } from '$ui'
  import { theme, ACCENTS } from '$lib/theme.svelte'
  import { auth } from '$lib/auth.svelte'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { formatDateTime, formatRelative } from '$lib/format'
  import type { Profile, SessionRow } from '$lib/types'

  let pw = $state({ current: '', next: '', repeat: '' })
  let busy = $state(false)
  let sessions = $state<SessionRow[]>([])

  $effect(() => {
    void api
      .get<SessionRow[]>('/auth/sessions')
      .then((value) => {
        sessions = value
      })
      .catch(() => {
        sessions = []
      })
  })

  async function changePassword() {
    if (pw.next.length < 10) {
      notify.warning('Новый пароль должен быть не короче 10 символов')
      return
    }
    if (pw.next !== pw.repeat) {
      notify.warning('Пароли не совпадают')
      return
    }
    busy = true
    try {
      const profile = await api.post<Profile>('/auth/password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      })
      auth.apply(profile)
      pw = { current: '', next: '', repeat: '' }
      notify.success('Пароль изменён')
    } catch (e) {
      notify.error('Не удалось сменить пароль', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function revokeOthers() {
    const ok = await notify.confirm({
      title: 'Завершить все прочие сессии?',
      confirmText: 'Завершить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      const res = await api.del<{ revoked: number }>('/auth/sessions')
      sessions = await api.get<SessionRow[]>('/auth/sessions')
      notify.success(`Завершено сессий: ${res.revoked}`)
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>Безопасность · Психолоджик</title></svelte:head>

<PageHeader title="Безопасность" subtitle="Учётная запись администратора" />

{#if auth.profile?.mustChangePassword}
  <Alert variant="danger" title="Пароль по умолчанию всё ещё в силе" class="mb-6">
    Смените его прямо сейчас — с ним в систему может зайти кто угодно, у кого есть журнал первого запуска.
  </Alert>
{/if}

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <Card title="Учётная запись">
    <div class="flex flex-col items-center text-center gap-4 py-2">
      <Avatar name={auth.profile?.fullName ?? ''} size={88} />
      <div>
        <div class="font-bold text-ink">{auth.profile?.fullName}</div>
        <div class="text-xs text-muted mt-0.5">@{auth.profile?.login}</div>
        <div class="mt-2"><Badge variant="accent">Администратор</Badge></div>
      </div>
    </div>
    {#snippet footer()}
      <p class="text-xs text-faint">
        Администратор не видит учеников, тесты и результаты — только список учётных записей психологов.
      </p>
    {/snippet}
  </Card>

  <Card title="Смена пароля" class="lg:col-span-2" accent>
    <div class="space-y-4">
      <Input bind:value={pw.current} label="Текущий пароль" type="password" icon="lock" autocomplete="current-password" />
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          bind:value={pw.next}
          label="Новый пароль"
          type="password"
          icon="key"
          hint="Минимум 10 символов"
          autocomplete="new-password"
        />
        <Input bind:value={pw.repeat} label="Повторите новый" type="password" icon="key" autocomplete="new-password" />
      </div>
    </div>
    {#snippet footer()}
      <Button icon="save" loading={busy} onclick={changePassword}>Обновить пароль</Button>
    {/snippet}
  </Card>

  <Card title="Оформление" class="lg:col-span-3">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div class="ng-label text-muted mb-2">Тема</div>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="border p-4 text-left transition-colors ng-tile-press cursor-pointer {theme.theme === 'dark'
              ? 'border-accent'
              : 'border-line hover:border-line-strong'}"
            onclick={() => theme.setTheme('dark')}
          >
            <span class="text-accent"><Icon name="moon" size={20} /></span>
            <div class="font-bold text-ink text-sm mt-3">Тёмная</div>
          </button>
          <button
            type="button"
            class="border p-4 text-left transition-colors ng-tile-press cursor-pointer {theme.theme === 'light'
              ? 'border-accent'
              : 'border-line hover:border-line-strong'}"
            onclick={() => theme.setTheme('light')}
          >
            <span class="text-accent"><Icon name="sun" size={20} /></span>
            <div class="font-bold text-ink text-sm mt-3">Светлая</div>
          </button>
        </div>
      </div>
      <div>
        <div class="ng-label text-muted mb-2">Акцентный цвет</div>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {#each ACCENTS as accent (accent.id)}
            <button
              type="button"
              aria-label={accent.label}
              class="relative h-14 border-2 transition-all ng-tile-press cursor-pointer {theme.accent === accent.id
                ? 'border-ink'
                : 'border-transparent hover:border-line-strong'}"
              style="background: {accent.hex}"
              onclick={() => theme.setAccent(accent.id)}
            >
              {#if theme.accent === accent.id}
                <span class="absolute top-2 right-2 text-white mix-blend-difference">
                  <Icon name="check" size={16} stroke={3} />
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </Card>

  <Card title="Активные устройства" class="lg:col-span-3" padding={false}>
    {#snippet actions()}
      <Button size="sm" variant="secondary" icon="logout" onclick={revokeOthers} disabled={sessions.length < 2}>
        Завершить остальные
      </Button>
    {/snippet}
    <Table
      columns={[
        { key: 'ip', label: 'Адрес', width: '160px' },
        { key: 'seen', label: 'Активность', width: '170px' },
        { key: 'until', label: 'Действует до', hideOnMobile: true },
      ]}
      rows={sessions}
      class="border-0"
      empty="Активных сессий нет"
    >
      {#snippet row(item)}
        <td class="px-4 py-3 align-middle font-mono text-xs text-muted">
          {item.ip || '—'}
          {#if item.current}<span class="ml-2"><Badge variant="accent">это устройство</Badge></span>{/if}
        </td>
        <td class="px-4 py-3 align-middle text-xs text-muted">{formatRelative(item.lastSeenAt)}</td>
        <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
          {formatDateTime(item.expiresAt)}
        </td>
      {/snippet}
    </Table>
  </Card>
</div>
