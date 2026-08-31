<script lang="ts">
  import {
    PageHeader,
    Card,
    Table,
    Badge,
    Button,
    Modal,
    Input,
    EmptyState,
    Dropdown,
    DropdownItem,
    Alert,
    Icon,
  } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { auth } from '$lib/auth.svelte'
  import { formatDate, formatRelative } from '$lib/format'
  import type { AccountRow } from '$lib/types'

  let rows = $state<AccountRow[]>([])
  let loading = $state(true)
  let busy = $state(false)

  let createOpen = $state(false)
  let form = $state({ fullName: '', login: '' })
  let customLogin = $state(false)

  const TRANSLIT: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }

  function translit(value: string): string {
    return [...value.toLowerCase()]
      .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : /[a-z0-9]/.test(ch) ? ch : ''))
      .join('')
  }

  // Логин собирается транслитом из ФИО — ровно так же, как на сервере.
  const suggestedLogin = $derived.by(() => {
    const parts = form.fullName.trim().split(/\s+/).filter(Boolean)
    const last = translit(parts[0] ?? '')
    const initial = translit(parts[1] ?? '').charAt(0)
    const base = initial ? `${last}.${initial}` : last
    return base.length >= 3 ? base : ''
  })

  $effect(() => {
    void load()
  })

  async function load() {
    loading = true
    try {
      rows = await api.get<AccountRow[]>('/accounts')
    } catch (e) {
      notify.error('Не удалось загрузить список', { text: errorMessage(e) })
    } finally {
      loading = false
    }
  }

  function openCreate() {
    form = { fullName: '', login: '' }
    customLogin = false
    createOpen = true
  }

  async function showCredentials(title: string, login: string, password: string) {
    await notify.secrets(
      title,
      `<p style="margin-bottom:12px">Передайте эти данные психологу лично. Пароль временный: при первом входе система потребует его сменить и подключить двухфакторную аутентификацию.</p>
       <div style="text-align:left;background:var(--ng-surface-2);border:1px solid var(--ng-line);padding:14px 16px;font-family:ui-monospace,monospace;font-size:15px">
         <div style="margin-bottom:6px"><span style="color:var(--ng-muted)">логин&nbsp;&nbsp;</span> <b>${login}</b></div>
         <div><span style="color:var(--ng-muted)">пароль</span> <b>${password}</b></div>
       </div>`,
    )
  }

  async function create() {
    if (form.fullName.trim().length < 3) {
      notify.warning('Укажите фамилию и имя психолога')
      return
    }
    busy = true
    try {
      const res = await api.post<{ account: AccountRow; temporaryPassword: string }>('/accounts', {
        fullName: form.fullName.trim(),
        ...(customLogin && form.login.trim() ? { login: form.login.trim().toLowerCase() } : {}),
      })
      createOpen = false
      await load()
      await showCredentials('Учётная запись создана', res.account.login, res.temporaryPassword)
    } catch (e) {
      notify.error('Не удалось создать учётную запись', { text: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  async function rename(account: AccountRow) {
    const value = await notify.prompt({
      title: 'Изменить имя',
      inputLabel: 'Фамилия и имя',
      inputValue: account.fullName,
      confirmText: 'Сохранить',
    })
    if (!value || value.trim() === account.fullName) {
      return
    }
    try {
      await api.patch(`/accounts/${account.id}`, { fullName: value.trim() })
      await load()
      notify.toast('Имя обновлено')
    } catch (e) {
      notify.error('Не удалось', { text: errorMessage(e) })
    }
  }

  async function resetPassword(account: AccountRow) {
    const ok = await notify.confirm({
      title: `Сбросить пароль ${account.fullName}?`,
      text: 'Будет выдан новый временный пароль, все активные сессии завершатся.',
      confirmText: 'Сбросить',
    })
    if (!ok) {
      return
    }
    try {
      const res = await api.post<{ temporaryPassword: string }>(`/accounts/${account.id}/reset-password`)
      await load()
      await showCredentials('Новый временный пароль', account.login, res.temporaryPassword)
    } catch (e) {
      notify.error('Не удалось сбросить пароль', { text: errorMessage(e) })
    }
  }

  async function resetTotp(account: AccountRow) {
    const ok = await notify.confirm({
      title: `Сбросить двухфакторку у ${account.fullName}?`,
      text: 'Делайте это, только если психолог действительно потерял доступ к телефону и резервным кодам. При следующем входе он настроит 2FA заново, все сессии завершатся.',
      confirmText: 'Сбросить 2FA',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.post(`/accounts/${account.id}/reset-totp`)
      await load()
      notify.success('Двухфакторка сброшена', {
        text: 'Психолог настроит её заново при следующем входе.',
      })
    } catch (e) {
      notify.error('Не удалось сбросить', { text: errorMessage(e) })
    }
  }

  async function remove(account: AccountRow) {
    const ok = await notify.confirm({
      title: `Удалить учётную запись ${account.fullName}?`,
      text: 'Психолог потеряет доступ. Созданные им тесты, заметки и выдачи останутся в системе.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) {
      return
    }
    try {
      await api.del(`/accounts/${account.id}`)
      await load()
      notify.toast('Учётная запись удалена')
    } catch (e) {
      notify.error('Не удалось удалить', { text: errorMessage(e) })
    }
  }
</script>

<svelte:head><title>Психологи · Психолоджик</title></svelte:head>

<PageHeader title="Психологи" subtitle="Единственное, чем занимается администратор: заводит учётные записи">
  {#snippet actions()}
    <Button icon="userPlus" onclick={openCreate}>Создать психолога</Button>
  {/snippet}
</PageHeader>

{#if auth.profile?.mustChangePassword}
  <Alert variant="danger" title="Смените пароль администратора" class="mb-6">
    Вы всё ещё пользуетесь паролем по умолчанию.
    {#snippet actions()}
      <Button size="sm" variant="secondary" href="/admin/security">К настройкам</Button>
    {/snippet}
  </Alert>
{/if}

{#if !loading && !rows.length}
  <Card padding={false}>
    <EmptyState
      icon="users"
      title="Учётных записей нет"
      description="Создайте учётку для школьного психолога: логин соберётся транслитом из ФИО, пароль сгенерируется автоматически и покажется один раз."
    >
      {#snippet actions()}
        <Button icon="userPlus" onclick={openCreate}>Создать психолога</Button>
      {/snippet}
    </EmptyState>
  </Card>
{:else}
  <Table
    columns={[
      { key: 'name', label: 'Психолог' },
      { key: 'login', label: 'Логин', width: '180px' },
      { key: 'state', label: 'Состояние', width: '210px' },
      { key: 'seen', label: 'Последний вход', width: '170px', hideOnMobile: true },
      { key: 'actions', label: '', align: 'right', width: '60px' },
    ]}
    rows={rows}
  >
    {#snippet row(item)}
      <td class="px-4 py-3 align-middle">
        <div class="font-semibold text-ink">{item.fullName}</div>
        <div class="text-xs text-faint">в системе с {formatDate(item.createdAt)}</div>
      </td>
      <td class="px-4 py-3 align-middle font-mono text-sm text-muted">{item.login}</td>
      <td class="px-4 py-3 align-middle">
        <div class="flex flex-wrap gap-1.5">
          {#if item.mustChangePassword}
            <Badge variant="warning" dot>Ждёт первого входа</Badge>
          {:else if item.totpEnabled}
            <Badge variant="success" dot>Активна</Badge>
          {:else}
            <Badge variant="info" dot>Настраивает 2FA</Badge>
          {/if}
          {#if item.activeSessions > 0}
            <Badge variant="neutral">{item.activeSessions} устр.</Badge>
          {/if}
        </div>
        {#if item.tempPassword}
          <div class="mt-1.5 text-xs text-muted">
            Временный пароль: <b class="font-mono text-ink">{item.tempPassword}</b>
          </div>
        {/if}
      </td>
      <td class="px-4 py-3 align-middle text-xs text-faint hidden md:table-cell">
        {formatRelative(item.lastSeenAt)}
      </td>
      <td class="px-4 py-3 align-middle text-right">
        <Dropdown align="right" width={250}>
          {#snippet trigger()}
            <span class="inline-flex p-2 text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer">
              <Icon name="more" size={18} />
            </span>
          {/snippet}
          {#snippet children()}
            <DropdownItem icon="edit" onclick={() => rename(item)}>Изменить имя</DropdownItem>
            <DropdownItem icon="key" onclick={() => resetPassword(item)}>Сбросить пароль</DropdownItem>
            <DropdownItem icon="shield" onclick={() => resetTotp(item)} disabled={!item.totpEnabled}>
              Сбросить двухфакторку
            </DropdownItem>
            <div class="my-1 border-t border-line"></div>
            <DropdownItem icon="trash" danger onclick={() => remove(item)}>Удалить</DropdownItem>
          {/snippet}
        </Dropdown>
      </td>
    {/snippet}
  </Table>
{/if}

<Modal bind:open={createOpen} title="Новый психолог" subtitle="Логин и временный пароль система выдаст сама" size="md">
  <div class="space-y-4">
    <Input
      bind:value={form.fullName}
      label="Фамилия и имя"
      icon="user"
      placeholder="Наземнова Наталья"
      hint="Порядок важен: сначала фамилия — из неё собирается логин"
      required
    />

    {#if suggestedLogin && !customLogin}
      <div class="bg-surface-2 border border-line px-4 py-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="ng-label text-muted">Логин будет</div>
          <div class="font-mono text-ink mt-0.5 truncate">{suggestedLogin}</div>
        </div>
        <Button size="sm" variant="ghost" onclick={() => { customLogin = true; form.login = suggestedLogin }}>
          Задать вручную
        </Button>
      </div>
    {/if}

    {#if customLogin}
      <Input
        bind:value={form.login}
        label="Логин"
        icon="user"
        hint="Строчные латинские буквы, цифры, точка и дефис"
        placeholder="naznemnova.n"
      />
    {/if}

    <Alert variant="info">
      Пароль сгенерируется автоматически и покажется один раз. При первом входе психолог обязан сменить его и
      подключить двухфакторную аутентификацию.
    </Alert>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (createOpen = false)}>Отмена</Button>
    <Button icon="userPlus" loading={busy} onclick={create}>Создать</Button>
  {/snippet}
</Modal>
