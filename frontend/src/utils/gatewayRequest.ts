import { ONEHUB_GATEWAY_MODE, ensureOneHubSession, gatewayApiPath, getOneHubCsrf } from '@/config/onehubGateway'

export async function gatewayFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (!ONEHUB_GATEWAY_MODE) return fetch(input, init)
  await ensureOneHubSession()
  const originalUrl = input instanceof Request ? input.url : String(input)
  const target = new URL(originalUrl, window.location.origin)
  const sameOrigin = target.origin === window.location.origin
  const headers = new Headers(init.headers)
  if (input instanceof Request) input.headers.forEach((value, key) => { if (!headers.has(key)) headers.set(key, value) })
  headers.delete('Authorization'); headers.delete('X-API-Key'); headers.delete('X-Tenant-ID')
  const method = (init.method || 'GET').toUpperCase()
  if (sameOrigin && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getOneHubCsrf(); if (csrf) headers.set('X-OneHub-CSRF', csrf)
  }
  return fetch(gatewayApiPath(originalUrl), { ...init, headers, credentials: sameOrigin ? 'include' : init.credentials })
}
