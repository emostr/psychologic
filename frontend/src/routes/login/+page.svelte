<script lang="ts">
  import { goto } from '$app/navigation'
  import { Icon, Input, Button, Alert } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { auth } from '$lib/auth.svelte'
  import type { Profile } from '$lib/types'

  type LoginResponse = { stage: 'session'; profile: Profile } | { stage: 'totp'; ticket: string }

  let stage = $state<'credentials' | 'totp'>('credentials')
  let login = $state('')
  let password = $state('')
  let code = $state('')
  let ticket = $state('')
  let busy = $state(false)
  let error = $state('')

  // Уже вошедшего пускать на форму входа незачем.
  $effect(() => {
    void auth.ensure().then((profile) => {
      if (profile) {
        void goto(profile.setupStep !== 'done' ? '/setup' : profile.role === 'ADMIN' ? '/admin' : '/dashboard', {
          replaceState: true,
        })
      }
    })
  })

  async function finish(profile: Profile) {
    auth.apply(profile)
    await goto(
      profile.setupStep !== 'done' ? '/setup' : profile.role === 'ADMIN' ? '/admin' : '/dashboard',
      { replaceState: true },
    )
  }

  async function submitCredentials(event: Event) {
    event.preventDefault()
    if (!login.trim() || !password) {
      error = 'Введите логин и пароль'
      return
    }
    busy = true
    error = ''
    try {
      const res = await api.post<LoginResponse>('/auth/login', { login: login.trim(), password })
      if (res.stage === 'totp') {
        ticket = res.ticket
        stage = 'totp'
      } else {
        await finish(res.profile)
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }

  async function submitTotp(event: Event) {
    event.preventDefault()
    if (!code.trim()) {
      error = 'Введите код из приложения'
      return
    }
    busy = true
    error = ''
    try {
      const res = await api.post<{ profile: Profile }>('/auth/login/totp', { ticket, code: code.trim() })
      await finish(res.profile)
    } catch (e) {
      error = errorMessage(e)
      code = ''
    } finally {
      busy = false
    }
  }

  function back() {
    stage = 'credentials'
    code = ''
    ticket = ''
    error = ''
    password = ''
  }

  async function help() {
    await notify.info('Забыли пароль или потеряли телефон?', {
      text: 'Обратитесь к администратору платформы — он сбросит пароль или двухфакторную аутентификацию. Если у вас сохранились резервные коды, введите любой из них вместо кода приложения.',
      timer: 9000,
    })
  }
</script>

<svelte:head><title>Вход · Психолоджик</title></svelte:head>

<div class="min-h-screen grid lg:grid-cols-2 bg-bg">
  <div class="hidden lg:flex flex-col justify-between p-12 bg-accent text-on-accent relative overflow-hidden">
    <div class="absolute -right-16 -top-16 w-72 h-72 border-[24px] border-on-accent/10"></div>
    <div class="absolute right-20 bottom-24 w-40 h-40 bg-on-accent/10"></div>
    <div class="flex items-center gap-2.5 relative">
      <span class="w-9 h-9 bg-on-accent text-accent flex items-center justify-center">
        <Icon name="brain" size={20} />
      </span>
      <span class="text-xl font-extrabold tracking-normal">Психолоджик</span>
    </div>
    <div class="relative">
      <h1 class="text-4xl font-extrabold leading-tight tracking-normal">
        Кабинет<br />школьного<br />психолога
      </h1>
      <p class="mt-4 max-w-sm text-on-accent/80 text-sm leading-relaxed">
        Классы, тестирование по QR-кодам, результаты поимённо и сводка по всей школе — в одном месте.
      </p>
    </div>
  </div>

  <div class="flex items-center justify-center p-6 sm:p-12">
    <div class="w-full max-w-sm ng-enter">
      <div class="lg:hidden flex items-center gap-2.5 mb-8">
        <span class="w-8 h-8 bg-accent text-on-accent flex items-center justify-center">
          <Icon name="brain" size={17} />
        </span>
        <span class="font-extrabold text-ink">Психо<span class="text-accent">лоджик</span></span>
      </div>

      <div class="w-10 h-1 bg-accent mb-4"></div>

      {#if stage === 'credentials'}
        <h2 class="text-2xl font-extrabold text-ink tracking-normal">Вход в кабинет</h2>
        <p class="text-muted text-sm mt-1 mb-8">Логин и пароль выдаёт администратор платформы</p>

        <form class="space-y-4" onsubmit={submitCredentials}>
          {#if error}<Alert variant="danger">{error}</Alert>{/if}
          <Input bind:value={login} label="Логин" placeholder="Имя пользователя" icon="user" autocomplete="username" />
          <Input
            bind:value={password}
            label="Пароль"
            type="password"
            placeholder="••••••••"
            icon="lock"
            autocomplete="current-password"
          />
          <Button type="submit" block size="lg" loading={busy} iconRight="arrowRight">Войти</Button>
        </form>
      {:else}
        <h2 class="text-2xl font-extrabold text-ink tracking-normal">Подтверждение входа</h2>
        <p class="text-muted text-sm mt-1 mb-8">
          Откройте приложение-аутентификатор и введите шестизначный код. Можно ввести резервный код.
        </p>

        <form class="space-y-4" onsubmit={submitTotp}>
          {#if error}<Alert variant="danger">{error}</Alert>{/if}
          <Input
            bind:value={code}
            label="Код подтверждения"
            placeholder="000000"
            icon="shield"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
          />
          <Button type="submit" block size="lg" loading={busy} iconRight="arrowRight">Подтвердить</Button>
          <Button variant="ghost" block icon="arrowLeft" onclick={back}>Назад</Button>
        </form>
      {/if}

      <div class="mt-8 pt-6 border-t border-line flex items-center justify-between gap-3">
        <a href="/t" class="text-xs text-muted hover:text-accent transition-colors">Я ученик, у меня есть код</a>
        <button type="button" class="text-xs text-faint hover:text-ink transition-colors cursor-pointer" onclick={help}>
          Проблемы со входом?
        </button>
      </div>
    </div>
  </div>
</div>
