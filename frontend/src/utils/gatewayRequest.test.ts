import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { fileURLToPath } from 'node:url'

let server: ViteDevServer
let gatewayFetch: typeof import('./gatewayRequest').gatewayFetch
let calls: Array<{ url: string; init: RequestInit }> = []
let account = 'one'

before(async () => {
  server = await createServer({
    configFile: false,
    define: { 'import.meta.env.VITE_ONEHUB_GATEWAY': JSON.stringify('1') },
    resolve: { alias: [{ find: '@', replacement: fileURLToPath(new URL('../', import.meta.url)) }] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  })
  ;({ gatewayFetch } = await server.ssrLoadModule('/src/utils/gatewayRequest.ts'))
  Object.defineProperty(globalThis, 'window', { value: { location: { origin: 'https://onehub.test' } }, configurable: true })
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === '/api/auth/me') return new Response(JSON.stringify({ user: { id: account }, csrf: `csrf-${account}` }), { status: 200 })
    return new Response('{}', { status: 200 })
  }) as typeof fetch
})

after(async () => { await server?.close() })

test('gateway fetch keeps accounts isolated and strips browser credentials', async () => {
  calls = []
  await gatewayFetch('/api/v1/knowledge-bases', {
    method: 'POST',
    headers: { Authorization: 'Bearer leaked', 'X-API-Key': 'leaked', 'X-Tenant-ID': 'leaked' },
    body: '{}',
  })
  assert.equal(calls[0].url, '/api/auth/me')
  assert.equal(calls[1].url, '/weknora/api/v1/knowledge-bases')
  const first = new Headers(calls[1].init.headers)
  assert.equal(first.get('X-OneHub-CSRF'), 'csrf-one')
  assert.equal(first.get('Authorization'), null)
  assert.equal(first.get('X-API-Key'), null)
  assert.equal(first.get('X-Tenant-ID'), null)

  account = 'two'
  const { resetOneHubSession } = await server.ssrLoadModule('/src/config/onehubGateway.ts')
  resetOneHubSession()
  await gatewayFetch('/api/v1/knowledge-bases', { method: 'POST', body: '{}' })
  assert.equal(calls.at(-2)?.url, '/api/auth/me')
  const second = new Headers(calls.at(-1)?.init.headers)
  assert.equal(second.get('X-OneHub-CSRF'), 'csrf-two')
})
