export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = '') {
    super(message)
    this.status = status
    this.code = code
  }

  /** 423 — сессия жива, но требует ПИН-код. Разлогинивать не нужно. */
  get isLocked(): boolean {
    return this.status === 423 || this.code === 'SESSION_LOCKED'
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Неизвестная ошибка'
}

type LockHandler = () => void
let onLocked: LockHandler | null = null

/** Оболочка приложения подписывается сюда, чтобы показать оверлей ввода ПИН. */
export function setLockHandler(handler: LockHandler | null): void {
  onLocked = handler
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, { credentials: 'include', ...options })
  const type = res.headers.get('content-type') || ''
  const isJson = type.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const body = (isJson ? data : null) as { message?: string; error?: string } | null
    const error = new ApiError(
      body?.message || 'Ошибка запроса к серверу',
      res.status,
      body?.error || '',
    )
    if (error.isLocked) {
      onLocked?.()
    }
    throw error
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Собирает query-строку, пропуская пустые значения. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
