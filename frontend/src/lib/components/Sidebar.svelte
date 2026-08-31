<script lang="ts">
  import { page } from '$app/state'
  import { Icon, Avatar } from '$ui'
  import { auth } from '$lib/auth.svelte'

  interface NavLink {
    href: string
    label: string
    icon: string
  }

  interface NavSection {
    title: string
    links: NavLink[]
  }

  interface Props {
    open?: boolean
    onclose?: () => void
  }

  let { open = false, onclose }: Props = $props()

  const PSYCHOLOGIST: NavSection[] = [
    {
      title: 'Работа',
      links: [
        { href: '/dashboard', label: 'Обзор', icon: 'dashboard' },
        { href: '/classes', label: 'Классы', icon: 'grid' },
        { href: '/students', label: 'Ученики', icon: 'users' },
      ],
    },
    {
      title: 'Тестирование',
      links: [
        { href: '/tests', label: 'Тесты', icon: 'clipboard' },
        { href: '/campaigns', label: 'Выдача QR', icon: 'qr' },
        { href: '/results', label: 'Результаты', icon: 'fileText' },
        { href: '/analytics', label: 'Аналитика', icon: 'barChart' },
      ],
    },
    {
      title: 'Прочее',
      links: [{ href: '/settings', label: 'Настройки', icon: 'settings' }],
    },
  ]

  const ADMIN: NavSection[] = [
    {
      title: 'Администрирование',
      links: [
        { href: '/admin', label: 'Психологи', icon: 'users' },
        { href: '/admin/security', label: 'Безопасность', icon: 'shield' },
      ],
    },
  ]

  const sections = $derived(auth.isAdmin ? ADMIN : PSYCHOLOGIST)
  const settingsHref = $derived(auth.isAdmin ? '/admin/security' : '/settings')

  function isActive(href: string): boolean {
    if (href === '/admin' || href === '/dashboard') {
      return page.url.pathname === href
    }
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/')
  }
</script>

<aside
  class="fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-bg border-r border-line flex flex-col transition-transform duration-200 lg:translate-x-0 {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
>
  <a href={auth.isAdmin ? '/admin' : '/dashboard'} class="h-16 flex items-center gap-2.5 px-5 border-b border-line shrink-0">
    <span class="w-8 h-8 bg-accent flex items-center justify-center shrink-0 text-on-accent">
      <Icon name="brain" size={18} />
    </span>
    <div class="leading-tight">
      <div class="font-extrabold text-ink tracking-normal">Психо<span class="text-accent">лоджик</span></div>
      <div class="text-[10px] text-faint uppercase font-bold">
        {auth.isAdmin ? 'Администрирование' : 'Кабинет психолога'}
      </div>
    </div>
  </a>

  <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
    {#each sections as section (section.title)}
      <div>
        <div class="ng-label text-faint px-3 mb-1.5">{section.title}</div>
        {#each section.links as link (link.href)}
          <a
            href={link.href}
            onclick={onclose}
            class="group flex items-center gap-3 px-3 py-2.5 text-sm border-l-2 transition-colors {isActive(
              link.href,
            )
              ? 'text-ink bg-surface-2 border-accent font-semibold'
              : 'text-muted border-transparent hover:text-ink hover:bg-surface-2'}"
          >
            <span class="shrink-0"><Icon name={link.icon} size={18} /></span>
            <span class="flex-1">{link.label}</span>
          </a>
        {/each}
      </div>
    {/each}
  </nav>

  {#if auth.profile}
    <div class="border-t border-line p-3 shrink-0">
      <a href={settingsHref} onclick={onclose} class="flex items-center gap-3 p-2 hover:bg-surface-2 transition-colors">
        <Avatar name={auth.profile.fullName} size={38} />
        <div class="min-w-0 flex-1 leading-tight">
          <div class="text-sm font-bold text-ink truncate">{auth.profile.fullName}</div>
          <div class="text-[11px] text-accent font-semibold uppercase tracking-normal">
            {auth.isAdmin ? 'Администратор' : 'Психолог'}
          </div>
        </div>
        <span class="text-faint"><Icon name="chevronRight" size={16} /></span>
      </a>
    </div>
  {/if}
</aside>
