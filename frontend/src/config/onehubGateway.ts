/** Build-time mode for the protected OneHub same-origin console. */
export const ONEHUB_GATEWAY_MODE = import.meta.env.VITE_ONEHUB_GATEWAY === '1'

let oneHubCsrf = ''
let bootstrapPromise: Promise<boolean> | null = null
let bootstrapSucceeded = false

export function setOneHubCsrf(value: string | null | undefined): void {
  oneHubCsrf = typeof value === 'string' ? value : ''
}

export function getOneHubCsrf(): string { return oneHubCsrf }

export function resetOneHubSession(): void {
  oneHubCsrf = ''
  bootstrapSucceeded = false
  bootstrapPromise = null
}

export function ensureOneHubSession(force = false): Promise<boolean> {
  if (!ONEHUB_GATEWAY_MODE) return Promise.resolve(true)
  if (bootstrapSucceeded && !force) return Promise.resolve(true)
  if (force) bootstrapPromise = null
  if (bootstrapPromise) return bootstrapPromise
  bootstrapPromise = fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async response => {
      if (!response.ok) return false
      const payload = await response.json() as { user?: unknown; csrf?: string }
      if (!payload.user || typeof payload.csrf !== 'string' || !payload.csrf) return false
      setOneHubCsrf(payload.csrf)
      bootstrapSucceeded = true
      return true
    }).catch(() => false)
  return bootstrapPromise
}

export function gatewayApiPath(input: string): string {
  if (!ONEHUB_GATEWAY_MODE || !input) return input
  try {
    const url = new URL(input, window.location.origin)
    if (url.origin !== window.location.origin) return input
    if (url.pathname === '/api/auth/me' || url.pathname.startsWith('/weknora/')) return input
    if (url.pathname.startsWith('/api/')) {
      url.pathname = `/weknora${url.pathname}`
      return url.pathname + url.search + url.hash
    }
  } catch { /* keep relative input */ }
  return input.startsWith('/api/') ? `/weknora${input}` : input
}
