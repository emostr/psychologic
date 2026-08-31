import { api } from './api'
import type { Profile } from './types'

class AuthStore {
  profile = $state<Profile | null>(null)
  ready = $state(false)
  /** Оверлей ввода ПИН-кода поверх интерфейса. */
  locked = $state(false)

  get isAdmin(): boolean {
    return this.profile?.role === 'ADMIN'
  }

  get isPsychologist(): boolean {
    return this.profile?.role === 'PSYCHOLOGIST'
  }

  /** Пока настройка не завершена, рабочие разделы закрыты. */
  get needsSetup(): boolean {
    return Boolean(this.profile && this.profile.setupStep !== 'done')
  }

  apply(profile: Profile | null): void {
    this.profile = profile
    this.locked = Boolean(profile?.locked)
    this.ready = true
  }

  async load(): Promise<Profile | null> {
    try {
      const profile = await api.get<Profile>('/auth/me')
      this.apply(profile)
      return profile
    } catch {
      this.apply(null)
      return null
    }
  }

  async ensure(): Promise<Profile | null> {
    if (this.ready) {
      return this.profile
    }
    return this.load()
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      /* сессия могла истечь — всё равно очищаем состояние */
    }
    this.profile = null
    this.locked = false
  }
}

export const auth = new AuthStore()
