import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogger } from './log.ts'
import { SITEVERIFY_URL, verifyTurnstile } from './turnstile.ts'
import type { TurnstileParams } from './turnstile.ts'
import { makeFakeNetwork, PROD_HOST } from './test-helpers.ts'
import type { FakeNetworkOptions } from './test-helpers.ts'

function params(netOpts: FakeNetworkOptions, over: Partial<TurnstileParams> = {}) {
  const net = makeFakeNetwork(netOpts)
  const logs: string[] = []
  const p: TurnstileParams = {
    token: 'tok',
    secret: 'test-secret',
    production: true,
    allowedHostnames: new Set([PROD_HOST]),
    fetchFn: net.fetch,
    log: createLogger((l) => logs.push(l)),
    ...over,
  }
  return { p, net, logs }
}

describe('verifyTurnstile', () => {
  it('token pre-check: no outbound call for a missing, non-string, empty or oversized token', async () => {
    for (const token of [undefined, null, '', 7, {}, [], 'a'.repeat(2049)]) {
      const { p, net } = params({}, { token })
      assert.deepEqual(await verifyTurnstile(p), { kind: 'rejected' })
      assert.equal(net.calls.length, 0)
    }
    const { p, net } = params({}, { token: 'a'.repeat(2048) })
    assert.deepEqual(await verifyTurnstile(p), { kind: 'ok' })
    assert.equal(net.calls.length, 1)
  })
  it('posts the secret and the response in the form body to the fixed URL', async () => {
    const { p, net } = params({}, { token: 'tok+/=&x' })
    await verifyTurnstile(p)
    const call = net.calls[0]!
    assert.equal(call.url, SITEVERIFY_URL)
    assert.equal(call.method, 'POST')
    assert.equal(call.headers['content-type'], 'application/x-www-form-urlencoded')
    const form = new URLSearchParams(call.body)
    assert.equal(form.get('secret'), 'test-secret')
    assert.equal(form.get('response'), 'tok+/=&x')
    assert.deepEqual([...form.keys()].sort(), ['response', 'secret'])
  })
  it('production needs success AND an allowed hostname AND action service-request', async () => {
    const good = params({ turnstile: { hostname: PROD_HOST, action: 'service-request' } })
    assert.deepEqual(await verifyTurnstile(good.p), { kind: 'ok' })
    for (const t of [{ hostname: 'evil.example' }, { hostname: 'example.com' }, { action: 'login' }, { action: undefined as unknown as string, rawBody: '{"success":true,"hostname":"' + PROD_HOST + '"}' }]) {
      const { p } = params({ turnstile: t })
      assert.deepEqual(await verifyTurnstile(p), { kind: 'rejected' }, JSON.stringify(t))
    }
  })
  it('outside production success alone is enough', async () => {
    const { p } = params({ turnstile: { hostname: 'example.com', action: 'test' } }, { production: false })
    assert.deepEqual(await verifyTurnstile(p), { kind: 'ok' })
  })
  it('success:false is rejected and the Cloudflare error codes (only) are logged', async () => {
    const { p, logs } = params({ turnstile: { success: false, errorCodes: ['timeout-or-duplicate', 'Weird Code With Spaces', 'x'.repeat(80)] } })
    assert.deepEqual(await verifyTurnstile(p), { kind: 'rejected' })
    assert.deepEqual(JSON.parse(logs[0]!), { event: 'turnstile_failed', codes: ['timeout-or-duplicate'] })
  })
  it('S2: invalid-input-secret / missing-input-secret are "misconfigured"; visitor-caused codes stay "rejected"', async () => {
    for (const code of ['invalid-input-secret', 'missing-input-secret']) {
      const { p, logs } = params({ turnstile: { success: false, errorCodes: [code, 'extra-vendor-code'] } })
      assert.deepEqual(await verifyTurnstile(p), { kind: 'misconfigured' }, code)
      assert.deepEqual(logs.map((l) => JSON.parse(l) as unknown), [{ event: 'config_invalid', names: ['TURNSTILE_SECRET_KEY'] }])
    }
    for (const code of ['invalid-input-response', 'missing-input-response', 'timeout-or-duplicate', 'bad-request']) {
      const { p } = params({ turnstile: { success: false, errorCodes: [code] } })
      assert.deepEqual(await verifyTurnstile(p), { kind: 'rejected' }, code)
    }
  })
  it('success must be exactly true', async () => {
    for (const raw of ['{"success":"true"}', '{"success":1}', '{}', '[]', 'null', '"x"']) {
      const { p } = params({ turnstile: { rawBody: raw } })
      const r = await verifyTurnstile(p)
      assert.notEqual(r.kind, 'ok', raw)
    }
  })
  it('network error, timeout abort, non-2xx, bad JSON and internal-error are all "unavailable" (fail closed)', async () => {
    const cases: FakeNetworkOptions['turnstile'][] = [
      { throws: new TypeError('fetch failed') },
      { throws: new DOMException('aborted', 'AbortError') },
      { status: 500 },
      { status: 403 },
      { rawBody: '<html>' },
      { success: false, errorCodes: ['internal-error'] },
    ]
    for (const t of cases) {
      const { p, logs } = params({ turnstile: t })
      assert.deepEqual(await verifyTurnstile(p), { kind: 'unavailable' }, JSON.stringify(t))
      assert.equal((JSON.parse(logs[0]!) as { event: string }).event, 'turnstile_unreachable')
    }
  })
  it('really times out: a hung siteverify is aborted after timeoutMs', async () => {
    const hang = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as typeof fetch
    const logs: string[] = []
    const t0 = performance.now()
    const r = await verifyTurnstile({
      token: 'tok',
      secret: 's',
      production: true,
      allowedHostnames: new Set([PROD_HOST]),
      fetchFn: hang,
      log: createLogger((l) => logs.push(l)),
      timeoutMs: 40,
    })
    assert.deepEqual(r, { kind: 'unavailable' })
    assert.ok(performance.now() - t0 < 1000)
    assert.deepEqual(JSON.parse(logs[0]!), { event: 'turnstile_unreachable', errorName: 'TimeoutError' })
  })
  it('the default timeout is 3 seconds', async () => {
    let seen: AbortSignal | null | undefined
    const spy = (async (_u: unknown, init?: RequestInit) => {
      seen = init?.signal
      return new Response('{"success":true}', { status: 200 })
    }) as typeof fetch
    const { p } = params({}, { fetchFn: spy, production: false })
    await verifyTurnstile(p)
    assert.ok(seen instanceof AbortSignal)
    assert.equal(seen.aborted, false)
  })
})
