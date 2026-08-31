import { browser } from '$app/environment'

const THEME_KEY = 'ng-theme'
const ACCENT_KEY = 'ng-accent'

export interface Accent {
  id: string
  label: string
  hex: string
}

export const ACCENTS: Accent[] = [
  { id: 'teal', label: 'Teal', hex: '#00b294' },
  { id: 'azure', label: 'Azure', hex: '#0078d4' },
  { id: 'magenta', label: 'Magenta', hex: '#e3008c' },
  { id: 'amber', label: 'Amber', hex: '#e88c00' },
  { id: 'violet', label: 'Violet', hex: '#8764b8' },
  { id: 'lime', label: 'Lime', hex: '#7cbb00' },
]

function stored(key: string, fallback: string): string {
  if (!browser) {
    return fallback
  }
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

class ThemeStore {
  theme = $state(stored(THEME_KEY, 'dark'))
  accent = $state(stored(ACCENT_KEY, 'teal'))
  /** Растёт при каждой смене темы — по нему графики перерисовываются. */
  revision = $state(0)

  private apply(): void {
    if (!browser) {
      return
    }
    const el = document.documentElement
    el.setAttribute('data-theme', this.theme)
    el.setAttribute('data-accent', this.accent)
    this.revision += 1
  }

  private persist(key: string, value: string): void {
    if (!browser) {
      return
    }
    try {
      localStorage.setItem(key, value)
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  }

  init(): void {
    this.apply()
  }

  setTheme(value: string): void {
    this.theme = value
    this.persist(THEME_KEY, value)
    this.apply()
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
  }

  setAccent(value: string): void {
    this.accent = value
    this.persist(ACCENT_KEY, value)
    this.apply()
  }
}

export const theme = new ThemeStore()

/** Значение CSS-переменной — нужно графикам, они не понимают классы Tailwind. */
export function cssVar(name: string): string {
  if (!browser) {
    return '#888888'
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888'
}

const TONE_VARS: Record<string, string> = {
  accent: '--ng-accent',
  success: '--ng-success',
  warning: '--ng-warning',
  danger: '--ng-danger',
  info: '--ng-info',
  neutral: '--ng-muted',
}

/** Цвет уровня интерпретации в виде hex — для Chart.js. */
export function toneColor(tone: string): string {
  return cssVar(TONE_VARS[tone] ?? '--ng-muted')
}
