<script lang="ts">
  import { goto } from '$app/navigation'
  import { Icon, Input, Button, Alert, Card, Select, QrCode } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { auth } from '$lib/auth.svelte'
  import { PIN_INTERVALS } from '$lib/catalog'
  import type { Profile } from '$lib/types'

  let ready = $state(false)
  let busy = $state(false)
  let error = $state('')

  // Шаг 1 — пароль
  let currentPassword = $state('')
  let newPassword = $state('')
  let repeatPassword = $state('')

  // Шаг 2 — TOTP
  let secret = $state('')
  let otpauthUrl = $state('')
  let totpCode = $state('')
  let showSecret = $state(false)

  // Шаг 3 — ПИН
  let pin = $state('')
  let pinRepeat = $state('')
  let interval = $state<string | number>(180)

  const step = $derived(auth.profile?.setupStep ?? 'password')

  const STEPS = [
    { key: 'password', label: 'Пароль', icon: 'key' },
    { key: 'totp', label: 'Двухфакторка', icon: 'shield' },
    { key: 'pin', label: 'ПИН-код', icon: 'lock' },
  ]

  const stepIndex = $derived(Math.max(0, STEPS.findIndex((s) => s.key === step)))

  $effect(() => {
    void auth.ensure().then((profile) => {
      if (!profile) {
        return goto('/login', { replaceState: true })
      }
      if (profile.setupStep === 'done') {
        return goto(profile.role === 'ADMIN' ? '/admin' : '/dashboard', { replaceState: true })
      }
      ready = true
      return undefined
    })
  })

  // Секрет для аутентификатора запрашиваем ровно когда дошли до второго шага.
  $effect(() => {
    if (step === 'totp' && !secret && ready) {
      void startTotp()
    }
  })

  async function startTotp() {
    try {
      const res = await api.post<{ secret: string; otpauthUrl: string }>('/auth/totp/setup')
      secret = res.secret
      otpauthUrl = res.otpauthUrl
    } catch (e) {
      error = errorMessage(e)
    }
  }

  async function advance(profile: Profile) {
    auth.apply(profile)
    error = ''
    if (profile.setupStep === 'done') {
      await notify.toast('Настройка завершена')
      await goto(profile.role === 'ADMIN' ? '/admin' : '/dashboard', { replaceState: true })
    }
  }

  async function submitPassword(event: Event) {
    event.preventDefault()
    if (newPassword.length < 10) {
      error = 'Новый пароль должен быть не короче 10 символов'
      return
    }
    if (newPassword !== repeatPassword) {
      error = 'Пароли не совпадают'
      return
    }
    busy = true
    error = ''
    try {
      const profile = await api.post<Profile>('/auth/password', { currentPassword, newPassword })
      currentPassword = newPassword = repeatPassword = ''
      await advance(profile)
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }

  async function submitTotp(event: Event) {
    event.preventDefault()
    busy = true
    error = ''
    try {
      const res = await api.post<{ backupCodes: string[] }>('/auth/totp/confirm', { code: totpCode.trim() })
      totpCode = ''
      await showBackupCodes(res.backupCodes)
      const profile = await api.get<Profile>('/auth/me')
      await advance(profile)
    } catch (e) {
      error = errorMessage(e)
      totpCode = ''
    } finally {
      busy = false
    }
  }

  async function showBackupCodes(codes: string[]) {
    const list = codes
      .map((code) => `<code style="display:block;padding:4px 0;font-size:15px;letter-spacing:0">${code}</code>`)
      .join('')
    await notify.secrets(
      'Резервные коды',
      `<p style="margin-bottom:12px">Каждый код срабатывает один раз и заменяет код из приложения. Распечатайте или запишите их и держите отдельно от телефона.</p>
       <div style="text-align:left;background:var(--ng-surface-2);border:1px solid var(--ng-line);padding:12px 16px;font-family:ui-monospace,monospace">${list}</div>`,
    )
  }

  async function submitPin(event: Event) {
    event.preventDefault()
    if (!/^\d{4,8}$/.test(pin)) {
      error = 'ПИН-код — от 4 до 8 цифр'
      return
    }
    if (pin !== pinRepeat) {
      error = 'ПИН-коды не совпадают'
      return
    }
    busy = true
    error = ''
    try {
      const profile = await api.post<Profile>('/auth/pin', { pin, intervalMinutes: Number(interval) })
      pin = pinRepeat = ''
      await advance(profile)
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }

  async function signOut() {
    await auth.logout()
    await goto('/login')
  }
</script>

<svelte:head><title>Первичная настройка · Психолоджик</title></svelte:head>

{#if ready}
  <div class="min-h-screen bg-bg flex flex-col">
    <header class="h-16 border-b border-line flex items-center justify-between px-4 sm:px-8 shrink-0">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 bg-accent text-on-accent flex items-center justify-center">
          <Icon name="brain" size={17} />
        </span>
        <span class="font-extrabold text-ink">Психо<span class="text-accent">лоджик</span></span>
      </div>
      <Button variant="ghost" size="sm" icon="logout" onclick={signOut}>Выйти</Button>
    </header>

    <main class="flex-1 flex items-start justify-center p-4 sm:p-8">
      <div class="w-full max-w-xl ng-enter">
        <div class="w-10 h-1 bg-accent mb-3"></div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-ink tracking-normal">Первичная настройка</h1>
        <p class="text-muted text-sm mt-1 mb-6">
          Три коротких шага — и кабинет готов к работе. Пропустить их нельзя: в системе хранятся персональные
          данные учеников.
        </p>

        <ol class="flex items-stretch border border-line bg-surface mb-6">
          {#each STEPS as item, index (item.key)}
            <li
              class="flex-1 flex items-center gap-2.5 px-3 sm:px-4 py-3 border-l first:border-l-0 border-line {index ===
              stepIndex
                ? 'bg-surface-2'
                : ''}"
            >
              <span
                class="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold {index < stepIndex
                  ? 'bg-success text-white'
                  : index === stepIndex
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-3 text-faint'}"
              >
                {#if index < stepIndex}
                  <Icon name="check" size={14} stroke={3} />
                {:else}
                  {index + 1}
                {/if}
              </span>
              <span
                class="text-xs font-bold truncate {index === stepIndex
                  ? 'text-ink'
                  : index < stepIndex
                    ? 'text-muted'
                    : 'text-faint'}"
              >
                {item.label}
              </span>
            </li>
          {/each}
        </ol>

        {#if error}<div class="mb-4"><Alert variant="danger">{error}</Alert></div>{/if}

        {#if step === 'password'}
          <Card title="Смена временного пароля" accent>
            <form class="space-y-4" onsubmit={submitPassword}>
              <Input
                bind:value={currentPassword}
                label="Текущий пароль"
                type="password"
                icon="lock"
                placeholder="Тот, что выдал администратор"
                autocomplete="current-password"
              />
              <Input
                bind:value={newPassword}
                label="Новый пароль"
                type="password"
                icon="key"
                placeholder="••••••••••"
                hint="Минимум 10 символов. Не используйте пароль от других сервисов."
                autocomplete="new-password"
              />
              <Input
                bind:value={repeatPassword}
                label="Повторите новый пароль"
                type="password"
                icon="key"
                placeholder="••••••••••"
                autocomplete="new-password"
              />
              <Button type="submit" block size="lg" loading={busy} iconRight="arrowRight">
                Сохранить пароль
              </Button>
            </form>
          </Card>
        {:else if step === 'totp'}
          <Card title="Двухфакторная аутентификация" accent>
            <p class="text-sm text-muted mb-5">
              Установите на телефон Google Authenticator, Яндекс.Ключ, Aegis или любое другое приложение с
              поддержкой TOTP и отсканируйте код.
            </p>

            <div class="flex flex-col sm:flex-row gap-6 items-start">
              <div class="shrink-0 mx-auto sm:mx-0 border border-line p-3 bg-white">
                {#if otpauthUrl}
                  <QrCode value={otpauthUrl} size={168} level="M" />
                {:else}
                  <div class="w-[168px] h-[168px] bg-surface-2 animate-pulse"></div>
                {/if}
              </div>

              <div class="flex-1 min-w-0 w-full">
                <button
                  type="button"
                  class="ng-label text-muted hover:text-accent transition-colors cursor-pointer mb-2 flex items-center gap-1.5"
                  onclick={() => (showSecret = !showSecret)}
                >
                  <Icon name={showSecret ? 'eyeOff' : 'eye'} size={13} />
                  Ключ для ручного ввода
                </button>
                {#if showSecret}
                  <div class="bg-surface-2 border border-line px-3 py-2 mb-4 font-mono text-xs break-all text-ink">
                    {secret}
                  </div>
                {/if}

                <form class="space-y-4" onsubmit={submitTotp}>
                  <Input
                    bind:value={totpCode}
                    label="Код из приложения"
                    placeholder="000000"
                    icon="shield"
                    inputmode="numeric"
                    maxlength={6}
                  />
                  <Button type="submit" block loading={busy} iconRight="arrowRight">Подключить</Button>
                </form>
              </div>
            </div>
          </Card>
        {:else}
          <Card title="ПИН-код для быстрой блокировки" accent>
            <p class="text-sm text-muted mb-5">
              Из системы вы не выходите неделями — сессия живёт долго. Но если отойти от компьютера, экран
              прикроется и попросит ПИН. Пароль и код из приложения при этом вводить не придётся.
            </p>
            <form class="space-y-4" onsubmit={submitPin}>
              <div class="grid grid-cols-2 gap-4">
                <Input
                  bind:value={pin}
                  label="ПИН-код"
                  type="password"
                  icon="lock"
                  inputmode="numeric"
                  maxlength={8}
                  placeholder="••••"
                />
                <Input
                  bind:value={pinRepeat}
                  label="Повторите ПИН"
                  type="password"
                  icon="lock"
                  inputmode="numeric"
                  maxlength={8}
                  placeholder="••••"
                />
              </div>
              <Select
                bind:value={interval}
                label="Спрашивать ПИН через"
                options={PIN_INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
                hint="Отсчёт идёт от последней разблокировки, а не от последнего клика"
              />
              <Button type="submit" block size="lg" loading={busy} iconRight="arrowRight">
                Завершить настройку
              </Button>
            </form>
          </Card>
        {/if}
      </div>
    </main>
  </div>
{/if}
