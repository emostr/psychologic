<script lang="ts">
  import {
    PageHeader,
    Card,
    Tabs,
    Icon,
    Badge,
    Button,
    Input,
    Select,
    Table,
    Alert,
    Avatar,
  } from '$ui'
  import { theme, ACCENTS } from '$lib/theme.svelte'
  import { auth } from '$lib/auth.svelte'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { PIN_INTERVALS } from '$lib/catalog'
  import { formatDateTime, formatRelative } from '$lib/format'
  import type { Profile, SessionRow } from '$lib/types'

  let tab = $state('appearance')
  let sessions = $state<SessionRow[]>([])
  let busy = $state('')

  let pw = $state({ current: '', next: '', repeat: '' })
  let pinForm = $state({ current: '', next: '', repeat: '', interval: 180 as string | number })

  $effect(() => {
    pinForm.interval = auth.profile?.pinIntervalMinutes ?? 180
  })

  $effect(() => {
    if (tab === 'sessions') {
      void loadSessions()
    }
  })

  async function loadSessions() {
    try {
      sessions = await api.get<SessionRow[]>('/auth/sessions')
    } catch (e) {
      notify.error('Не удалось загрузить сессии', { text: errorMessage(e) })
    }
  }

  async function changePassword() {
    if (pw.next.length < 10) {
      notify.warning('Новый пароль должен быть не короче 10 символов')
      return
    }
    if (pw.next !== pw.repeat) {
      notify.warning('Пароли не совпадают')
      return
    }
    busy = 'password'
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
      busy = ''
    }
  }

  async function changePin() {
    if (!/^\d{4,8}$/.test(pinForm.next)) {
      notify.warning('ПИН-код — от 4 до 8 цифр')
      return
    }
    if (pinForm.next !== pinForm.repeat) {
      notify.warning('ПИН-коды не совпадают')
      return
    }
    busy = 'pin'
    try {
      const profile = await api.post<Profile>('/auth/pin', {
        pin: pinForm.next,
        currentPin: pinForm.current || undefined,
        intervalMinutes: Number(pinForm.interval),
      })
      auth.apply(profile)
      pinForm = { current: '', next: '', repeat: '', interval: profile.pinIntervalMinutes }
      notify.success('ПИН-код обновлён')
    } catch (e) {
      notify.error('Не удалось сменить ПИН', { text: errorMessage(e) })
    } finally {
      busy = ''
    }
  }

  async function saveInterval(value: string) {
    if (!auth.profile?.hasPin) {
      return
    }
    const currentPin = await notify.prompt({
      title: 'Подтвердите ПИН-кодом',
      inputLabel: 'Текущий ПИН',
      inputType: 'password',
      confirmText: 'Сохранить',
    })
    if (!currentPin) {
      return
    }
    try {
      const profile = await api.post<Profile>('/auth/pin', {
        pin: currentPin,
        currentPin,
        intervalMinutes: Number(value),
      })
      auth.apply(profile)
      notify.toast('Интервал сохранён')
    } catch (e) {
      notify.error('Не удалось сохранить', { text: errorMessage(e) })
    }
  }

  async function regenerateBackupCodes() {
    const ok = await notify.confirm({
      title: 'Выпустить новые резервные коды?',
      text: 'Старые коды перестанут работать сразу же. Новые показываются один раз — запишите их.',
      confirmText: 'Выпустить',
    })
    if (!ok) {
      return
    }
    try {
      const res = await api.post<{ backupCodes: string[] }>('/auth/backup-codes')
      const list = res.backupCodes
        .map((code) => `<code style="display:block;padding:4px 0;font-size:15px">${code}</code>`)
        .join('')
      await notify.secrets(
        'Новые резервные коды',
        `<p style="margin-bottom:12px">Каждый код срабатывает один раз вместо кода из приложения. Держите их отдельно от телефона.</p>
         <div style="text-align:left;background:var(--ng-surface-2);border:1px solid var(--ng-line);padding:12px 16px;font-family:ui-monospace,monospace">${list}</div>`,
      )
      await auth.load()
    } catch (e) {
      notify.error('Не удалось выпустить коды', { text: errorMessage(e) })
    }
  }

  async function revoke(session: SessionRow) {
    const ok = await notify.confirm({
      title: 'Завершить сессию?',
      text: 'На том устройстве придётся войти заново.',
      confirmText: 'Завершить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/auth/sessions/${session.id}`)
      await loadSessions()
      notify.toast('Сессия завершена')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function revokeOthers() {
    const ok = await notify.confirm({
      title: 'Завершить все прочие сессии?',
      text: 'Текущее устройство останется, остальные разлогинятся.',
      confirmText: 'Завершить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      const res = await api.del<{ revoked: number }>('/auth/sessions')
      await loadSessions()
      notify.success(`Завершено сессий: ${res.revoked}`)
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  function deviceLabel(userAgent: string): string {
    if (/iPhone|iPad|Android|Mobile/i.test(userAgent)) {
      return 'Телефон или планшет'
    }
    if (/Windows/i.test(userAgent)) {
      return 'Компьютер · Windows'
    }
    if (/Macintosh|Mac OS/i.test(userAgent)) {
      return 'Компьютер · macOS'
    }
    if (/Linux/i.test(userAgent)) {
      return 'Компьютер · Linux'
    }
    return 'Неизвестное устройство'
  }
</script>

<svelte:head><title>Настройки · Психолоджик</title></svelte:head>

<PageHeader title="Настройки" />

<Tabs
  bind:value={tab}
  tabs={[
    { value: 'appearance', label: 'Оформление', icon: 'palette' },
    { value: 'security', label: 'Безопасность', icon: 'shield' },
    { value: 'sessions', label: 'Устройства', icon: 'monitor' },
  ]}
  class="mb-6"
/>

{#if tab === 'appearance'}
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card title="Тема">
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="border p-4 text-left transition-colors ng-tile-press cursor-pointer {theme.theme === 'dark'
            ? 'border-accent'
            : 'border-line hover:border-line-strong'}"
          onclick={() => theme.setTheme('dark')}
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-accent"><Icon name="moon" size={20} /></span>
            {#if theme.theme === 'dark'}
              <span class="text-accent"><Icon name="checkCircle" size={18} /></span>
            {/if}
          </div>
          <div class="font-bold text-ink text-sm">Тёмная</div>
        </button>
        <button
          type="button"
          class="border p-4 text-left transition-colors ng-tile-press cursor-pointer {theme.theme === 'light'
            ? 'border-accent'
            : 'border-line hover:border-line-strong'}"
          onclick={() => theme.setTheme('light')}
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-accent"><Icon name="sun" size={20} /></span>
            {#if theme.theme === 'light'}
              <span class="text-accent"><Icon name="checkCircle" size={18} /></span>
            {/if}
          </div>
          <div class="font-bold text-ink text-sm">Светлая</div>
        </button>
      </div>
    </Card>

    <Card title="Акцентный цвет">
      <div class="grid grid-cols-3 gap-3">
        {#each ACCENTS as accent (accent.id)}
          <button
            type="button"
            class="relative h-16 border-2 transition-all ng-tile-press cursor-pointer flex items-end p-2 {theme.accent ===
            accent.id
              ? 'border-ink'
              : 'border-transparent hover:border-line-strong'}"
            style="background: {accent.hex}"
            onclick={() => theme.setAccent(accent.id)}
          >
            <span class="text-[11px] font-bold text-white mix-blend-difference">{accent.label}</span>
            {#if theme.accent === accent.id}
              <span class="absolute top-2 right-2 text-white mix-blend-difference">
                <Icon name="check" size={18} stroke={3} />
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </Card>
  </div>
{:else if tab === 'security'}
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <Card title="Профиль" class="lg:col-span-1">
      <div class="flex flex-col items-center text-center gap-4 py-2">
        <Avatar name={auth.profile?.fullName ?? ''} size={88} />
        <div>
          <div class="font-bold text-ink">{auth.profile?.fullName}</div>
          <div class="text-xs text-muted mt-0.5">@{auth.profile?.login}</div>
          <div class="mt-2"><Badge variant="accent">Психолог</Badge></div>
        </div>
      </div>
      {#snippet footer()}
        <p class="text-xs text-faint">
          Имя и логин меняет администратор платформы.
        </p>
      {/snippet}
    </Card>

    <Card title="Двухфакторная аутентификация" class="lg:col-span-2" accent>
      <div class="flex items-start gap-4">
        <span class="w-11 h-11 shrink-0 bg-success/15 text-success flex items-center justify-center">
          <Icon name="shieldCheck" size={22} />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-ink font-semibold">Подключена</p>
          <p class="text-sm text-muted mt-1">
            При входе запрашивается код из приложения. Осталось резервных кодов:
            <b class="text-ink">{auth.profile?.unusedBackupCodes ?? 0}</b> из 10.
          </p>
          {#if (auth.profile?.unusedBackupCodes ?? 0) <= 3}
            <div class="mt-3">
              <Alert variant="warning">
                Резервных кодов почти не осталось. Выпустите новые, пока телефон под рукой.
              </Alert>
            </div>
          {/if}
        </div>
      </div>
      {#snippet footer()}
        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon="key" onclick={regenerateBackupCodes}>
            Новые резервные коды
          </Button>
          <span class="text-xs text-faint self-center">
            Потеряли телефон и коды — обратитесь к администратору, он сбросит 2FA.
          </span>
        </div>
      {/snippet}
    </Card>

    <Card title="Смена пароля" class="lg:col-span-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input bind:value={pw.current} label="Текущий пароль" type="password" icon="lock" autocomplete="current-password" />
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
      {#snippet footer()}
        <Button icon="save" loading={busy === 'password'} onclick={changePassword}>Обновить пароль</Button>
      {/snippet}
    </Card>

    <Card title="ПИН-код" subtitle="Быстрая блокировка экрана без выхода из системы" class="lg:col-span-3">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Input
          bind:value={pinForm.current}
          label="Текущий ПИН"
          type="password"
          icon="lock"
          inputmode="numeric"
          maxlength={8}
        />
        <Input bind:value={pinForm.next} label="Новый ПИН" type="password" inputmode="numeric" maxlength={8} />
        <Input bind:value={pinForm.repeat} label="Повторите" type="password" inputmode="numeric" maxlength={8} />
        <Select
          bind:value={pinForm.interval}
          label="Блокировать через"
          options={PIN_INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
          onchange={saveInterval}
        />
      </div>
      {#snippet footer()}
        <Button icon="save" loading={busy === 'pin'} onclick={changePin}>Сменить ПИН</Button>
      {/snippet}
    </Card>
  </div>
{:else}
  <Card
    title="Активные устройства"
    subtitle="Сессия живёт долго — из системы вы не выходите. Если устройство чужое, завершите сессию."
    padding={false}
  >
    {#snippet actions()}
      <Button size="sm" variant="secondary" icon="logout" onclick={revokeOthers} disabled={sessions.length < 2}>
        Завершить остальные
      </Button>
    {/snippet}
    <Table
      columns={[
        { key: 'device', label: 'Устройство' },
        { key: 'ip', label: 'Адрес', width: '150px', hideOnMobile: true },
        { key: 'seen', label: 'Активность', width: '160px' },
        { key: 'until', label: 'Действует до', width: '160px', hideOnMobile: true },
        { key: 'actions', label: '', align: 'right', width: '120px' },
      ]}
      rows={sessions}
      class="border-0"
      empty="Активных сессий нет"
    >
      {#snippet row(item)}
        <td class="px-4 py-3 align-middle">
          <div class="flex items-center gap-2">
            <span class="text-muted"><Icon name={/Mobile|Android|iPhone/i.test(item.userAgent) ? 'smartphone' : 'monitor'} size={16} /></span>
            <span class="text-ink text-sm">{deviceLabel(item.userAgent)}</span>
            {#if item.current}<Badge variant="accent">это устройство</Badge>{/if}
          </div>
        </td>
        <td class="px-4 py-3 align-middle text-xs text-muted font-mono hidden md:table-cell">{item.ip || '—'}</td>
        <td class="px-4 py-3 align-middle text-xs text-muted">{formatRelative(item.lastSeenAt)}</td>
        <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
          {formatDateTime(item.expiresAt)}
        </td>
        <td class="px-4 py-3 align-middle text-right">
          {#if !item.current}
            <Button size="sm" variant="ghost" icon="close" onclick={() => revoke(item)}>Завершить</Button>
          {/if}
        </td>
      {/snippet}
    </Table>
  </Card>
{/if}
