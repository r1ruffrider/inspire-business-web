import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readConfig } from './config.js'
import type { Config } from './config.js'
import { checkOrigin, clientKey, createRateLimiter, normalizeIp, readJsonBody } from './guards.js'
import { localEnv, previewEnv, prodEnv } from './test-helpers.js'

function cfg(env: Parameters<typeof readConfig>[0]): Config {
  const r = readConfig(env)
  assert.ok(r.ok)
  return r.config
}

const reqWith = (headers: Record<string, string>): Request => new Request('http://x/', { headers })

describe('checkOrigin', () => {
  const prod = cfg(prodEnv())
  it('exact match only', () => {
    assert.equal(checkOrigin('https://www.inspirebusinesstechnology.com', prod), true)
    const bad = [
      null,
      '',
      'null',
      'https://www.inspirebusinesstechnology.com.evil.example',
      'http://www.inspirebusinesstechnology.com',
      'https://evilwww.inspirebusinesstechnology.com',
      'https://inspirebusinesstechnology.com',
      'https://www.inspirebusinesstechnology.com/',
      ' https://www.inspirebusinesstechnology.com',
      'https://www.inspirebusinesstechnology.com ',
      'HTTPS://www.inspirebusinesstechnology.com',
      'a'.repeat(5000),
    ]
    for (const o of bad) assert.equal(checkOrigin(o, prod), false, String(o).slice(0, 40))
  })
  it('localhost only via the anchored regex and only off Vercel', () => {
    const local = cfg(localEnv())
    for (const ok of ['http://localhost', 'http://localhost:5190', 'http://127.0.0.1:3000']) {
      assert.equal(checkOrigin(ok, local), true, ok)
    }
    const bad = [
      'http://localhost.evil.test',
      'http://localhost:5190.evil.test',
      'https://localhost:5190',
      'http://evil.test/http://localhost',
      'http://localhostx',
      'http://127.0.0.1.evil.test',
      'http://localhost:123456',
      'http://localhost:',
      'http://localhost/',
    ]
    for (const o of bad) assert.equal(checkOrigin(o, local), false, o)
    assert.equal(checkOrigin('http://localhost:5190', prod), false)
    assert.equal(checkOrigin('http://localhost:5190', cfg(previewEnv())), false)
  })
})

describe('normalizeIp and clientKey', () => {
  it('IPv4 as is; IPv4-mapped IPv6 becomes IPv4; IPv6 keys on its /64', () => {
    assert.equal(normalizeIp('203.0.113.7'), '203.0.113.7')
    assert.equal(normalizeIp('::ffff:203.0.113.7'), '203.0.113.7')
    assert.equal(normalizeIp('::ffff:cb00:7107'), '203.0.113.7')
    assert.equal(normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), 'v6/64:2001:db8:1:2')
    assert.equal(normalizeIp('2001:db8:1:2::1'), 'v6/64:2001:db8:1:2')
    assert.equal(normalizeIp('2001:DB8:1:2::9'), 'v6/64:2001:db8:1:2')
    assert.equal(normalizeIp('2001:db8::1'), 'v6/64:2001:db8:0:0')
    assert.equal(normalizeIp('::1'), 'v6/64:0:0:0:0')
    assert.equal(normalizeIp('fe80::1%eth0'), 'v6/64:fe80:0:0:0')
  })
  it('rejects garbage', () => {
    for (const bad of ['', 'unknown', 'a.b.c.d', '999.1.1.1', '1.2.3', ':::', '2001:db8::1::2', 'x'.repeat(100), '1.2.3.4, 5.6.7.8']) {
      assert.equal(normalizeIp(bad), null, bad)
    }
  })
  it('on Vercel only x-vercel-forwarded-for counts', () => {
    const vercel = cfg(prodEnv())
    assert.deepEqual(clientKey(reqWith({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' }), vercel), { key: '203.0.113.7', headerMissing: false })
    assert.deepEqual(clientKey(reqWith({ 'x-forwarded-for': '1.1.1.1' }), vercel), { key: 'unknown', headerMissing: true })
    assert.deepEqual(clientKey(reqWith({ 'x-vercel-forwarded-for': '  ' }), vercel), { key: 'unknown', headerMissing: true })
    assert.deepEqual(clientKey(reqWith({}), vercel, '9.9.9.9'), { key: 'unknown', headerMissing: true })
    assert.deepEqual(clientKey(reqWith({ 'x-vercel-forwarded-for': 'garbage' }), vercel), { key: 'unknown', headerMissing: false })
  })
  it('off Vercel: first x-forwarded-for entry, then the socket address, then unknown', () => {
    const local = cfg(localEnv())
    assert.equal(clientKey(reqWith({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }), local).key, '198.51.100.4')
    assert.equal(clientKey(reqWith({}), local, '::ffff:127.0.0.1').key, '127.0.0.1')
    assert.equal(clientKey(reqWith({}), local).key, 'unknown')
  })
})

describe('createRateLimiter', () => {
  const T0 = 1_000_000
  it('allows perIp hits then refuses with Retry-After equal to the oldest hit expiry', () => {
    const l = createRateLimiter({ perIp: 3, windowMs: 600_000 })
    assert.deepEqual(l.checkIp('k', T0), { ok: true })
    assert.deepEqual(l.checkIp('k', T0 + 10_000), { ok: true })
    assert.deepEqual(l.checkIp('k', T0 + 20_000), { ok: true })
    assert.deepEqual(l.checkIp('k', T0 + 30_000), { ok: false, retryAfter: 570 })
    assert.deepEqual(l.checkIp('k', T0 + 599_000), { ok: false, retryAfter: 1 })
    // The oldest hit has expired: one slot frees up.
    assert.deepEqual(l.checkIp('k', T0 + 600_001), { ok: true })
    assert.deepEqual(l.checkIp('k', T0 + 600_002), { ok: false, retryAfter: 10 })
  })
  it('Retry-After is always between 1 and 600', () => {
    const l = createRateLimiter({ perIp: 1 })
    l.checkIp('k', T0)
    for (const dt of [0, 1, 999, 1000, 300_000, 599_999]) {
      const r = l.checkIp('k', T0 + dt)
      assert.ok(!r.ok)
      assert.ok(r.retryAfter >= 1 && r.retryAfter <= 600, String(r.retryAfter))
    }
  })
  it('a refused attempt does not extend the window', () => {
    const l = createRateLimiter({ perIp: 1, windowMs: 1000 })
    l.checkIp('k', T0)
    for (let i = 1; i < 50; i++) l.checkIp('k', T0 + i * 10)
    assert.deepEqual(l.checkIp('k', T0 + 1001), { ok: true })
  })
  it('keys are independent; the send cap is a separate single counter', () => {
    const l = createRateLimiter({ perIp: 1, sendCap: 2 })
    assert.equal(l.checkIp('a', T0).ok, true)
    assert.equal(l.checkIp('b', T0).ok, true)
    assert.equal(l.checkSend(T0).ok, true)
    assert.equal(l.checkSend(T0).ok, true)
    const third = l.checkSend(T0 + 1000)
    assert.ok(!third.ok)
    assert.equal(third.retryAfter, 599)
    assert.equal(l.checkSend(T0 + 600_001).ok, true)
  })
  it('checkIp never touches the send counter', () => {
    const l = createRateLimiter({ perIp: 100, sendCap: 1 })
    for (let i = 0; i < 50; i++) l.checkIp('k' + i, T0)
    assert.equal(l.checkSend(T0).ok, true)
  })
  it('caps the number of keys by evicting the oldest', () => {
    const l = createRateLimiter({ maxKeys: 3, perIp: 1 })
    for (const k of ['a', 'b', 'c', 'd']) l.checkIp(k, T0)
    assert.equal(l.keys().length, 3)
    assert.equal(l.checkIp('a', T0).ok, true, 'a was evicted, so it is new again')
  })
  it('expired keys are pruned on each call', () => {
    const l = createRateLimiter({ windowMs: 1000 })
    for (let i = 0; i < 20; i++) l.checkIp('k' + i, T0)
    l.checkIp('late', T0 + 5000)
    assert.equal(l.keys().length, 1)
  })
  it('a different salt gives different stored keys; no raw key is stored', () => {
    const a = createRateLimiter({ salt: new Uint8Array([1, 2, 3]) })
    const b = createRateLimiter({ salt: new Uint8Array([9, 9, 9]) })
    a.checkIp('203.0.113.7', T0)
    b.checkIp('203.0.113.7', T0)
    assert.notEqual(a.keys()[0], b.keys()[0])
    assert.match(a.keys()[0] as string, /^[0-9a-f]{64}$/)
    assert.ok(!(a.keys()[0] as string).includes('203'))
  })
  it('check and increment are one synchronous step: no await can interleave', async () => {
    const l = createRateLimiter({ perIp: 5 })
    const results = await Promise.all(
      Array.from({ length: 50 }, async () => {
        await Promise.resolve()
        return l.checkIp('k', T0)
      }),
    )
    assert.equal(results.filter((r) => r.ok).length, 5)
  })
})

describe('readJsonBody', () => {
  function post(body: string | Uint8Array | ReadableStream<Uint8Array> | null, headers: Record<string, string> = {}): Request {
    const init: RequestInit & { duplex?: 'half' } = { method: 'POST', headers }
    if (body !== null) {
      init.body = body
      if (typeof body !== 'string' && !(body instanceof Uint8Array)) init.duplex = 'half'
    }
    return new Request('http://x/', init)
  }

  it('parses a bounded JSON object', async () => {
    assert.deepEqual(await readJsonBody(post('{"a":1}'), 1024), { ok: true, value: { a: 1 } })
  })
  it('rejects over the cap by streaming, even without or with a lying Content-Length', async () => {
    assert.deepEqual(await readJsonBody(post('x'.repeat(2000)), 1024), { ok: false, status: 413 })
    assert.deepEqual(await readJsonBody(post('x'.repeat(2000), { 'content-length': '5' }), 1024), { ok: false, status: 413 })
    const chunks = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new Uint8Array(300))
        c.close()
      },
    })
    assert.deepEqual(await readJsonBody(post(chunks), 1024), { ok: false, status: 413 })
  })
  it('exactly at the cap is allowed', async () => {
    const json = '{"a":"' + 'x'.repeat(1024 - 8) + '"}'
    assert.equal(new TextEncoder().encode(json).length, 1024)
    assert.equal((await readJsonBody(post(json), 1024)).ok, true)
    assert.deepEqual(await readJsonBody(post(json + ' '), 1024), { ok: false, status: 413 })
  })
  it('a RangeError from JSON.parse (deep nesting) is caught and discarded', async () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw new RangeError('Maximum call stack size exceeded')
    }
    try {
      assert.deepEqual(await readJsonBody(post('{}'), 1024), { ok: false, status: 400 })
    } finally {
      JSON.parse = original
    }
  })
  it('no body, bad UTF-8 and bad JSON are 400', async () => {
    assert.deepEqual(await readJsonBody(new Request('http://x/', { method: 'POST' }), 1024), { ok: false, status: 400 })
    assert.deepEqual(await readJsonBody(post(new Uint8Array([0xc3, 0x28])), 1024), { ok: false, status: 400 })
    assert.deepEqual(await readJsonBody(post('{bad'), 1024), { ok: false, status: 400 })
  })
  it('A-16: a body that starts with a UTF-8 BOM is a 400, not parsed', async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const json = new TextEncoder().encode('{"a":1}')
    const withBom = new Uint8Array(bom.length + json.length)
    withBom.set(bom, 0)
    withBom.set(json, bom.length)
    assert.deepEqual(await readJsonBody(post(withBom), 1024), { ok: false, status: 400 })
    assert.deepEqual(await readJsonBody(post(json), 1024), { ok: true, value: { a: 1 } })
  })
  it('a BOM character inside a string value is untouched by the reader', async () => {
    const text = '{"a":"x' + String.fromCharCode(0xfeff) + 'y"}'
    const r = await readJsonBody(post(text), 1024)
    assert.deepEqual(r, { ok: true, value: { a: 'x' + String.fromCharCode(0xfeff) + 'y' } })
  })
  it('a stream that errors is a 400', async () => {
    const broken = new ReadableStream<Uint8Array>({
      pull(c) {
        c.error(new Error('boom'))
      },
    })
    assert.deepEqual(await readJsonBody(post(broken), 1024), { ok: false, status: 400 })
  })
})
