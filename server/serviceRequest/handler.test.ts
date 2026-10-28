/**
 * Abuse-case matrix (THREAT-MODEL section 3) against the real handler, with fake fetch for
 * Turnstile siteverify and Resend. No network.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleServiceRequest } from './handler.ts'
import { createRateLimiter } from './guards.ts'
import { isValidAsciiEmail } from '../../shared/serviceRequest.ts'
import {
  CRLF,
  INJECTION_PAYLOADS,
  FIXED_NOW,
  PROD_ORIGIN,
  REAL_INBOX,
  localEnv,
  makeHarness,
  makeRequest,
  prodEnv,
  previewEnv,
  resendPayload,
  u,
  validBody,
} from './test-helpers.ts'
import type { FakeNetwork, Harness } from './test-helpers.ts'

// ---------------------------------------------------------------------------
// Invariants every response must satisfy
// ---------------------------------------------------------------------------

const VENDOR = /resend|cloudflare|turnstile|vercel|stack|at\s+\S+\s+\(/i

async function check(res: Response, forbidden: string[] = []): Promise<string> {
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.match(res.headers.get('content-type') ?? '', /^application\/json; charset=utf-8$/)
  for (const [name] of res.headers) {
    assert.ok(!name.toLowerCase().startsWith('access-control-'), 'CORS header present: ' + name)
  }
  const text = await res.text()
  JSON.parse(text)
  assert.doesNotMatch(text, VENDOR, 'vendor name or stack in response')
  for (const f of forbidden) assert.ok(!text.includes(f), 'response echoes a submitted value')
  return text
}

const SENT_MARKER = 'ZETA-MARKER-7741'

function assertFixedResend(net: FakeNetwork, mailTo: string): Record<string, unknown> {
  const calls = net.resendCalls()
  assert.equal(calls.length, 1, 'exactly one Resend call')
  const call = calls[0]!
  assert.equal(call.url, 'https://api.resend.com/emails')
  assert.deepEqual(Object.keys(call.headers).sort(), ['authorization', 'content-type', 'idempotency-key'])
  const payload = JSON.parse(call.body) as Record<string, unknown>
  assert.deepEqual(Object.keys(payload).sort(), ['from', 'html', 'reply_to', 'subject', 'text', 'to'])
  assert.ok(Array.isArray(payload.to))
  assert.deepEqual(payload.to, [mailTo])
  assert.equal(typeof payload.reply_to, 'string')
  assert.ok(isValidAsciiEmail(payload.reply_to as string), 'reply_to is a bare valid address')
  assert.doesNotMatch(payload.subject as string, /[\p{Cc}\p{Zl}\p{Zp}]/u, 'subject has no CR/LF/control')
  assert.doesNotMatch(payload.text as string, /^(?:Bcc|Cc|To|From|Subject|Reply-To):/im, 'no forged header line in text')
  return payload
}

async function send(h: Harness, over: Parameters<typeof makeRequest>[0] = {}): Promise<Response> {
  return handleServiceRequest(makeRequest(over), h.deps)
}

// ---------------------------------------------------------------------------

describe('happy path', () => {
  it('accepts a valid request, sends one fixed-key Resend request, returns the reference', async () => {
    const h = makeHarness(prodEnv())
    const key = '3F9A21BC-1111-4222-8333-444455556666'
    const res = await send(h, { idempotencyKey: key })
    assert.equal(res.status, 200)
    const body = JSON.parse(await check(res)) as { ok: boolean; id: string }
    assert.deepEqual(body, { ok: true, id: 'SR-3F9A21BC' })
    const payload = assertFixedResend(h.net, REAL_INBOX)
    assert.equal(h.net.resendCalls()[0]!.headers['idempotency-key'], 'sr-' + key.toLowerCase())
    assert.equal(payload.reply_to, 'amira@acmecoffee.example')
    assert.equal(payload.subject, 'New service request: Website, Logo - Acme Coffee Roasters')
    assert.match(h.net.resendCalls()[0]!.headers.authorization ?? '', /^Bearer /)
    assert.deepEqual(h.logs.map((l) => (JSON.parse(l) as { event: string }).event), ['sent'])
  })

  it('prefixes [TEST] off production and not in production', async () => {
    const prod = makeHarness(prodEnv())
    await send(prod)
    assert.doesNotMatch(resendPayload(prod.net).subject as string, /^\[TEST\]/)
    const prev = makeHarness(previewEnv())
    await send(prev, { origin: 'https://site-abc123-team.vercel.app' })
    assert.match(resendPayload(prev.net).subject as string, /^\[TEST\] New service request/)
  })

  it('local dev: log transport prints the mail, only siteverify is called, localhost origin works', async () => {
    const printed: string[] = []
    const h = makeHarness(localEnv(), {}, { mailLog: (t) => printed.push(t) })
    const res = await send(h, { origin: 'http://localhost:5190' })
    assert.equal(res.status, 200)
    assert.equal(h.net.resendCalls().length, 0)
    assert.equal(h.net.siteverifyCalls().length, 1)
    assert.equal(printed.length, 1)
    assert.match(printed[0]!, /Untrusted content from a website visitor/)
  })

  it('duplicate JSON keys are last-wins (single parser)', async () => {
    const h = makeHarness(prodEnv())
    const raw = JSON.stringify(validBody()).replace('"name":"Amira Haddad"', '"name":"First","name":"Second Winner"')
    const res = await send(h, { rawBody: raw })
    assert.equal(res.status, 200)
    assert.match(resendPayload(h.net).text as string, /> Second Winner/)
  })
})

describe('method, content type, origin (steps 1 to 3)', () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
    it(`${method} gives 405 with Allow: POST and no CORS`, async () => {
      const h = makeHarness(prodEnv())
      const res = await send(h, { method })
      assert.equal(res.status, 405)
      assert.equal(res.headers.get('allow'), 'POST')
      if (method !== 'HEAD') assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'method' })
      assert.equal(h.net.calls.length, 0)
    })
  }

  for (const ct of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx', 'text/plain;application/json', null]) {
    it(`content type ${String(ct)} gives 415`, async () => {
      const h = makeHarness(prodEnv())
      const res = await send(h, { contentType: ct })
      assert.equal(res.status, 415)
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'unsupported' })
      assert.equal(h.net.calls.length, 0)
    })
  }

  it('application/json with a charset parameter is accepted', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { contentType: 'application/json; charset=utf-8' })
    assert.equal(res.status, 200)
  })

  const BAD_ORIGINS: Array<[string, string | null]> = [
    ['suffix attack', PROD_ORIGIN + '.evil.test'],
    ['prefix attack', 'https://evil.test/' + PROD_ORIGIN],
    ['http variant', 'http://www.inspirebusinesstechnology.com'],
    ['apex (not allowlisted)', 'https://inspirebusinesstechnology.com'],
    ['null literal', 'null'],
    ['missing header', null],
    ['localhost on Vercel', 'http://localhost:5173'],
    ['localhost lookalike', 'http://localhost.evil.test'],
    ['trailing slash', PROD_ORIGIN + '/'],
    ['uppercase host', 'https://WWW.inspirebusinesstechnology.com'],
    ['userinfo trick', 'https://www.inspirebusinesstechnology.com@evil.test'],
    ['port', PROD_ORIGIN + ':8443'],
    ['empty', ''],
  ]
  for (const [label, origin] of BAD_ORIGINS) {
    it(`origin ${label} gives 403 and no outbound call`, async () => {
      const h = makeHarness(prodEnv())
      const res = await send(h, { origin })
      assert.equal(res.status, 403)
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'forbidden' })
      assert.equal(h.net.calls.length, 0)
    })
  }

  it('no Referer fallback: a good Referer cannot rescue a missing Origin', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { origin: null, headers: { referer: PROD_ORIGIN + '/' } })
    assert.equal(res.status, 403)
  })

  it('Sec-Fetch-Site cross-site/same-site/none gives 403; same-origin passes', async () => {
    for (const value of ['cross-site', 'same-site', 'none']) {
      const h = makeHarness(prodEnv())
      const res = await send(h, { headers: { 'sec-fetch-site': value } })
      assert.equal(res.status, 403, value)
    }
    const h = makeHarness(prodEnv())
    const ok = await send(h, { headers: { 'sec-fetch-site': 'same-origin' } })
    assert.equal(ok.status, 200)
  })

  it('preview: this deployment and its branch alias pass; a foreign vercel.app does not', async () => {
    for (const o of ['https://site-abc123-team.vercel.app', 'https://site-git-feature-pro-upgrade-team.vercel.app']) {
      const h = makeHarness(previewEnv())
      assert.equal((await send(h, { origin: o })).status, 200, o)
    }
    const h = makeHarness(previewEnv())
    assert.equal((await send(h, { origin: 'https://other-project.vercel.app' })).status, 403)
    assert.equal((await send(h, { origin: 'https://undefined' })).status, 403)
  })

  it('preview with a missing VERCEL_BRANCH_URL adds no https://undefined entry', async () => {
    const env = previewEnv()
    delete env.VERCEL_BRANCH_URL
    const h = makeHarness(env)
    assert.equal((await send(h, { origin: 'https://undefined' })).status, 403)
    assert.equal((await send(h, { origin: 'https://site-abc123-team.vercel.app' })).status, 200)
  })

  it('production never trusts VERCEL_URL', async () => {
    const h = makeHarness(prodEnv({ VERCEL_URL: 'site-abc123-team.vercel.app', VERCEL_BRANCH_URL: 'x-git-y.vercel.app' }))
    assert.equal((await send(h, { origin: 'https://site-abc123-team.vercel.app' })).status, 403)
    assert.equal((await send(h, { origin: 'https://x-git-y.vercel.app' })).status, 403)
  })

  it('localhost passes only when VERCEL is unset', async () => {
    const local = makeHarness(localEnv())
    assert.equal((await send(local, { origin: 'http://127.0.0.1:5190' })).status, 200)
    assert.equal((await send(local, { origin: 'http://localhost.evil.test' })).status, 403)
    assert.equal((await send(local, { origin: 'http://localhost:5190.evil.test' })).status, 403)
    const preview = makeHarness(previewEnv())
    assert.equal((await send(preview, { origin: 'http://localhost:5190' })).status, 403)
  })
})

describe('body size and parsing (steps 4 to 6)', () => {
  it('a 33 KiB body gives 413', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ description: 'a'.repeat(33 * 1024) }) })
    assert.equal(res.status, 413)
    assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'too_large' })
    assert.equal(h.net.calls.length, 0)
  })

  it('a chunked body with no Content-Length gives 413 and stops reading', async () => {
    const h = makeHarness(prodEnv())
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled > 200) controller.close()
        else controller.enqueue(new TextEncoder().encode('x'.repeat(1024)))
      },
    })
    const req = makeRequest({ rawBody: stream })
    assert.equal(req.headers.get('content-length'), null)
    const res = await handleServiceRequest(req, h.deps)
    assert.equal(res.status, 413)
    assert.ok(pulled < 200, 'the reader stopped early (pulled ' + pulled + ' chunks)')
  })

  it('a lying small Content-Length does not defeat the cap', async () => {
    const h = makeHarness(prodEnv())
    const big = JSON.stringify(validBody({ description: 'a'.repeat(40 * 1024) }))
    const req = makeRequest({ rawBody: big, headers: { 'content-length': '10' } })
    assert.equal(req.headers.get('content-length'), '10', 'precondition: the lying header is really present')
    const res = await handleServiceRequest(req, h.deps)
    assert.equal(res.status, 413)
  })

  it('a large declared Content-Length is rejected before any read', async () => {
    const h = makeHarness(prodEnv())
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        controller.enqueue(new TextEncoder().encode('{}'))
        controller.close()
      },
    })
    const req = makeRequest({ rawBody: stream, headers: { 'content-length': '999999' } })
    const res = await handleServiceRequest(req, h.deps)
    assert.equal(res.status, 413)
    assert.ok(pulled <= 1, 'body not consumed (pulled ' + pulled + ')')
  })

  it('30,000-deep and 16,000-deep nested JSON never throw and are rejected', async () => {
    const h = makeHarness(prodEnv())
    const deep30k = '['.repeat(30000) + ']'.repeat(30000)
    const r1 = await send(h, { rawBody: deep30k })
    assert.ok([400, 413].includes(r1.status), 'status ' + r1.status)
    await check(r1)
    const deep16k = '['.repeat(16000) + ']'.repeat(16000)
    const r2 = await send(h, { rawBody: deep16k })
    assert.equal(r2.status, 400)
    await check(r2)
    const nestedField = JSON.stringify(validBody()).replace('"name":"Amira Haddad"', '"name":' + '['.repeat(10000) + ']'.repeat(10000))
    const r3 = await send(h, { rawBody: nestedField })
    assert.equal(r3.status, 422)
    assert.equal(h.net.calls.length, 0)
  })

  for (const [label, raw] of [
    ['malformed JSON', '{"name":'],
    ['empty body', ''],
    ['array', '[]'],
    ['string', '"x"'],
    ['number', '42'],
    ['null', 'null'],
    ['plain text', 'hello'],
  ] as const) {
    it(`${label} gives 400 and the parse error is not echoed`, async () => {
      const h = makeHarness(prodEnv())
      const res = await send(h, { rawBody: raw })
      assert.equal(res.status, 400)
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'bad_request' })
    })
  }

  it('A-16: a BOM-prefixed valid body gives the generic 400, never 200 or 500, and echoes nothing', async () => {
    const h = makeHarness(prodEnv())
    const json = new TextEncoder().encode(JSON.stringify(validBody({ name: 'Name' + SENT_MARKER })))
    const body = new Uint8Array(json.length + 3)
    body.set([0xef, 0xbb, 0xbf], 0)
    body.set(json, 3)
    const res = await send(h, { rawBody: body })
    assert.equal(res.status, 400)
    assert.deepEqual(JSON.parse(await check(res, [SENT_MARKER])), { ok: false, error: 'bad_request' })
    assert.equal(h.net.calls.length, 0)
  })

  it('a BOM character inside a field value is stripped by the text pipeline and the request succeeds', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ name: 'Amira' + String.fromCharCode(0xfeff) + ' Haddad' }) })
    assert.equal(res.status, 200)
    assert.match(resendPayload(h.net).text as string, /> Amira Haddad/)
  })

  it('invalid UTF-8 gives 400', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { rawBody: new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]) })
    assert.equal(res.status, 400)
  })

  for (const key of ['__proto__', 'budget', 'to', 'bcc', 'cc', 'from', 'reply_to', 'subject', 'headers', 'attachments', 'html', 'constructor']) {
    it(`unknown key ${key} gives 400 and sends nothing`, async () => {
      const h = makeHarness(prodEnv())
      // Raw JSON so that __proto__ becomes an OWN key, as a hostile client would send it.
      const raw = JSON.stringify(validBody()).slice(0, -1) + `,"${key}":"x@evil.test"}`
      const res = await send(h, { rawBody: raw })
      assert.equal(res.status, 400)
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'bad_request' })
      assert.equal(h.net.calls.length, 0)
    })
  }

  it('__proto__ as an object value is rejected without polluting anything', async () => {
    const h = makeHarness(prodEnv())
    const raw = JSON.stringify(validBody()).slice(0, -1) + ',"__proto__":{"polluted":true}}'
    const res = await send(h, { rawBody: raw })
    assert.equal(res.status, 400)
    assert.equal(({} as Record<string, unknown>).polluted, undefined)
  })

  it('services with 6+ raw items is a 400; 10 items too', async () => {
    for (const n of [7, 10, 50]) {
      const h = makeHarness(prodEnv())
      const res = await send(h, { body: validBody({ services: Array.from({ length: n }, () => 'website') }) })
      assert.equal(res.status, 400, 'n=' + n)
    }
  })

  it('a non-string honeypot is a 400; a missing honeypot is a 400', async () => {
    const h = makeHarness(prodEnv())
    assert.equal((await send(h, { body: validBody({ homepage_url: 5 }) })).status, 400)
    const b = validBody()
    delete b.homepage_url
    assert.equal((await send(h, { body: b })).status, 400)
  })

  it('Idempotency-Key must be a UUID v4 (header only); uppercase is lowercased', async () => {
    for (const bad of [null, '', 'abc', 'not-a-uuid-at-all-not-a-uuid-at-all-x', '3f9a21bc-1111-1222-8333-444455556666']) {
      const h = makeHarness(prodEnv())
      const res = await send(h, { idempotencyKey: bad })
      assert.equal(res.status, 400, String(bad))
    }
    const h = makeHarness(prodEnv())
    const up = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
    assert.equal((await send(h, { idempotencyKey: up })).status, 200)
    assert.equal(h.net.resendCalls()[0]!.headers['idempotency-key'], 'sr-' + up.toLowerCase())
  })
})

describe('validation (step 8)', () => {
  it('returns 422 with { field, code } pairs only: no value, no count, no line', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, {
      body: validBody({ name: '', email: 'not-an-email-' + SENT_MARKER, description: 'short', links: 'javascript:alert(1)', services: [] }),
    })
    assert.equal(res.status, 422)
    const text = await check(res, [SENT_MARKER, 'javascript'])
    const body = JSON.parse(text) as { error: string; errors: Array<Record<string, unknown>> }
    assert.equal(body.error, 'validation')
    for (const e of body.errors) assert.deepEqual(Object.keys(e).sort(), ['code', 'field'])
    const pairs = body.errors.map((e) => `${String(e.field)}:${String(e.code)}`).sort()
    assert.deepEqual(pairs, ['description:too_short', 'email:invalid', 'links:bad_scheme', 'name:required', 'services:required'])
    assert.equal(h.net.calls.length, 0, 'no token spent')
  })

  it('wrong types are rejected without coercion', async () => {
    for (const over of [{ consent: 'true' }, { consent: 1 }, { consent: false }, { name: 123 }, { services: 'website' }, { services: [1] }, { timeline: 5 }, { description: ['x'] }]) {
      const h = makeHarness(prodEnv())
      const res = await send(h, { body: validBody(over) })
      assert.equal(res.status, 422, JSON.stringify(over))
      assert.equal(h.net.calls.length, 0)
    }
  })

  it('a description with 6 URLs is rejected as too_many; 5 are accepted', async () => {
    const six = 'Please look at ' + Array.from({ length: 6 }, (_, i) => `https://site${i}.example/page`).join(' and ') + ' for the style.'
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ description: six }) })
    assert.equal(res.status, 422)
    assert.deepEqual((JSON.parse(await check(res)) as { errors: unknown[] }).errors, [{ field: 'description', code: 'too_many' }])
    const five = six.replace(/ and https:\/\/site5\.example\/page/, '')
    assert.equal((await send(makeHarness(prodEnv()), { body: validBody({ description: five }) })).status, 200)
  })

  it('links: 6 lines, a 301-character line, javascript:, data:, ftp:, credentials are all rejected', async () => {
    const cases = [
      Array.from({ length: 6 }, (_, i) => `a${i}.example`).join('\n'),
      'https://example.com/' + 'a'.repeat(290) + 'bbbbbbbbbbbbb',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/file',
      'https://user:pass@example.com',
    ]
    for (const links of cases) {
      const h = makeHarness(prodEnv())
      const res = await send(h, { body: validBody({ links }) })
      assert.equal(res.status, 422, links.slice(0, 30))
      assert.equal(h.net.calls.length, 0)
    }
  })
})

describe('honeypot (step 7)', () => {
  it('a filled honeypot gives the fake success, sends nothing, calls nothing, logs only the event name', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ homepage_url: 'http://bot.example/' + SENT_MARKER }) })
    assert.equal(res.status, 200)
    const body = JSON.parse(await check(res, [SENT_MARKER])) as { ok: boolean; id: string }
    assert.equal(body.ok, true)
    assert.match(body.id, /^SR-[0-9A-F]{8}$/)
    assert.equal(h.net.calls.length, 0, 'no siteverify and no Resend call')
    assert.deepEqual(h.logs, ['{"event":"honeypot"}'])
  })

  it('a whitespace-only honeypot is treated as untouched', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ homepage_url: '   ' }) })
    assert.equal(res.status, 200)
    assert.equal(h.net.resendCalls().length, 1)
  })

  it('the honeypot check happens before validation and before the rate limit', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 0 }) })
    const res = await send(h, { body: validBody({ homepage_url: 'x', name: '' }) })
    assert.equal(res.status, 200)
  })
})

describe('Turnstile (step 10)', () => {
  it('missing, null, non-string and over-long tokens give 403 with NO outbound call', async () => {
    const bad: unknown[] = [undefined, null, '', 42, true, ['x'], { a: 1 }, 'a'.repeat(2049)]
    for (const token of bad) {
      const h = makeHarness(prodEnv())
      const body = validBody()
      if (token === undefined) delete body.turnstile_token
      else body.turnstile_token = token
      const res = await send(h, { body })
      assert.equal(res.status, 403, String(token).slice(0, 10))
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'verification_failed' })
      assert.equal(h.net.calls.length, 0)
    }
  })

  it('a 2048-character token is allowed through to siteverify', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ turnstile_token: 'a'.repeat(2048) }) })
    assert.equal(res.status, 200)
    assert.equal(h.net.siteverifyCalls().length, 1)
  })

  it('the secret and the token travel in the POST body, never in the URL', async () => {
    const h = makeHarness(prodEnv())
    await send(h, { body: validBody({ turnstile_token: 'tok-abc-123' }) })
    const call = h.net.siteverifyCalls()[0]!
    assert.equal(call.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
    assert.ok(!call.url.includes('?') && !call.url.includes('tok-abc') && !call.url.includes('test-turnstile'))
    assert.equal(call.method, 'POST')
    const params = new URLSearchParams(call.body)
    assert.equal(params.get('secret'), 'test-turnstile-prod-secret')
    assert.equal(params.get('response'), 'tok-abc-123')
    assert.equal(params.has('remoteip'), false, 'no remoteip is sent')
    assert.equal(call.headers.authorization, undefined)
  })

  it('a forged or replayed (success:false) token gives 403 verification_failed and no mail', async () => {
    for (const codes of [['invalid-input-response'], ['timeout-or-duplicate'], ['bad-request']]) {
      const h = makeHarness(prodEnv(), { turnstile: { success: false, errorCodes: codes } })
      const res = await send(h)
      assert.equal(res.status, 403)
      assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'verification_failed' })
      assert.equal(h.net.resendCalls().length, 0)
      assert.deepEqual((JSON.parse(h.logs[0]!) as { codes: string[] }).codes, codes)
    }
  })

  it('S2: a wrong or missing Turnstile secret is a generic 500 and a config_invalid log with the variable name only', async () => {
    for (const code of ['invalid-input-secret', 'missing-input-secret']) {
      const h = makeHarness(prodEnv(), { turnstile: { success: false, errorCodes: [code, 'vendor-detail-' + SENT_MARKER.toLowerCase()] } })
      const res = await send(h, { body: validBody({ name: 'Name' + SENT_MARKER }) })
      assert.equal(res.status, 500, code)
      assert.deepEqual(JSON.parse(await check(res, [SENT_MARKER, code])), { ok: false, error: 'server' })
      assert.equal(h.net.resendCalls().length, 0)
      assert.deepEqual(h.logs.map((l) => JSON.parse(l) as unknown), [{ event: 'config_invalid', names: ['TURNSTILE_SECRET_KEY'] }])
      const all = h.logs.join('')
      assert.ok(!all.includes(code) && !all.includes('vendor-detail') && !all.includes(SENT_MARKER.toLowerCase()), 'nothing from the vendor response is logged')
    }
  })

  it('production: wrong hostname, placeholder hostname and wrong action all fail closed', async () => {
    for (const t of [{ hostname: 'evil.example' }, { hostname: 'example.com' }, { hostname: 'inspirebusinesstechnology.com' }, { action: 'other' }, { action: 'test' }, { action: '' }]) {
      const h = makeHarness(prodEnv(), { turnstile: t })
      const res = await send(h)
      assert.equal(res.status, 403, JSON.stringify(t))
      assert.equal(h.net.resendCalls().length, 0)
      assert.deepEqual(h.logs, ['{"event":"turnstile_mismatch"}'])
    }
  })

  it('production: a missing hostname or action in the response fails closed', async () => {
    const h = makeHarness(prodEnv(), { turnstile: { rawBody: '{"success":true}' } })
    assert.equal((await send(h)).status, 403)
  })

  it('production: the correct hostname and action pass', async () => {
    const h = makeHarness(prodEnv(), { turnstile: { hostname: 'www.inspirebusinesstechnology.com', action: 'service-request' } })
    assert.equal((await send(h)).status, 200)
  })

  it('preview and local: success alone passes (dummy keys return placeholder hostname/action)', async () => {
    const p = makeHarness(previewEnv(), { turnstile: { hostname: 'example.com', action: 'test' } })
    assert.equal((await send(p, { origin: 'https://site-abc123-team.vercel.app' })).status, 200)
    const l = makeHarness(localEnv(), { turnstile: { hostname: 'example.com', action: 'test' } })
    assert.equal((await send(l, { origin: 'http://localhost:5190' })).status, 200)
  })

  it('a documented test secret in production gives a config 500 and NO outbound call', async () => {
    for (const secret of ['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA']) {
      const h = makeHarness(prodEnv({ TURNSTILE_SECRET_KEY: secret }))
      const res = await send(h)
      assert.equal(res.status, 500)
      assert.deepEqual(JSON.parse(await check(res, [secret])), { ok: false, error: 'server' })
      assert.equal(h.net.calls.length, 0)
      assert.ok(!h.logs.join('').includes(secret))
      assert.deepEqual(JSON.parse(h.logs[0]!), { event: 'config_invalid', names: ['TURNSTILE_SECRET_KEY'] })
    }
  })

  it('Cloudflare unreachable (network error, timeout, 5xx, bad JSON, internal-error) gives 503 and no mail', async () => {
    const cases = [
      { throws: new TypeError('fetch failed: ' + SENT_MARKER) },
      { throws: new DOMException('timed out', 'TimeoutError') },
      { status: 500 },
      { rawBody: 'not json' },
      { success: false, errorCodes: ['internal-error'] },
    ]
    for (const t of cases) {
      const h = makeHarness(prodEnv(), { turnstile: t })
      const res = await send(h)
      assert.equal(res.status, 503)
      assert.deepEqual(JSON.parse(await check(res, [SENT_MARKER])), { ok: false, error: 'unavailable' })
      assert.equal(h.net.resendCalls().length, 0)
      assert.ok(!h.logs.join('').includes(SENT_MARKER), 'err.message is never logged')
    }
  })
})

describe('rate limiting (steps 9 and 11)', () => {
  it('the 6th rapid submit from one client gets 429 with a numeric Retry-After', async () => {
    const limiter = createRateLimiter()
    const h = makeHarness(prodEnv(), {}, { rateLimiter: limiter })
    const statuses: number[] = []
    let last: Response | undefined
    for (let i = 0; i < 6; i++) {
      last = await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })
      statuses.push(last.status)
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429])
    const retry = Number(last!.headers.get('retry-after'))
    assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= 600, 'Retry-After ' + retry)
    assert.deepEqual(JSON.parse(await check(last!)), { ok: false, error: 'rate_limited' })
    assert.equal(h.net.resendCalls().length, 5)
    assert.equal(h.logs.filter((l) => l.includes('rate_limited')).length, 1)
  })

  it('another client is unaffected by the first one hitting its limit', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 1 }) })
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })).status, 429)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.8' } })).status, 200)
  })

  it('validation errors do not burn the per-IP budget', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 1 }) })
    for (let i = 0; i < 4; i++) {
      assert.equal((await send(h, { body: validBody({ name: '' }), headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })).status, 422)
    }
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })).status, 200)
  })

  it('concurrent requests cannot both slip past the limit (check and increment are synchronous)', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 5 }) })
    const results = await Promise.all(
      Array.from({ length: 12 }, () => send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })),
    )
    const statuses = results.map((r) => r.status).sort()
    assert.equal(statuses.filter((s) => s === 200).length, 5)
    assert.equal(statuses.filter((s) => s === 429).length, 7)
    assert.equal(h.net.resendCalls().length, 5)
  })

  it('IPv6 addresses in one /64 share a bucket; a different /64 does not', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 1 }) })
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '2001:db8:aaaa:1::1' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '2001:db8:aaaa:1:ffff:ffff:ffff:ffff' } })).status, 429)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '2001:db8:aaaa:2::1' } })).status, 200)
  })

  it('IPv4-mapped IPv6 shares a bucket with the IPv4 address', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 1 }) })
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '::ffff:203.0.113.7' } })).status, 429)
  })

  it('on Vercel a missing x-vercel-forwarded-for shares one "unknown" bucket and logs ip_header_missing; x-forwarded-for is ignored', async () => {
    const h = makeHarness(prodEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 2 }) })
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '198.51.100.1' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '198.51.100.2' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '198.51.100.3' } })).status, 429)
    assert.equal(h.logs.filter((l) => l.includes('ip_header_missing')).length, 3)
    assert.ok(!h.logs.join('').includes('198.51.100'))
  })

  it('off Vercel, x-forwarded-for and the socket address are used', async () => {
    const h = makeHarness(localEnv(), {}, { rateLimiter: createRateLimiter({ perIp: 1 }), remoteAddress: '127.0.0.1' })
    const o = { origin: 'http://localhost:5190' }
    assert.equal((await send(h, { ...o, headers: { 'x-forwarded-for': '198.51.100.1' } })).status, 200)
    assert.equal((await send(h, { ...o, headers: { 'x-forwarded-for': '198.51.100.2' } })).status, 200)
    assert.equal((await send(h, { ...o, headers: { 'x-forwarded-for': '198.51.100.1' } })).status, 429)
    assert.equal((await send(h, o)).status, 200)
    assert.equal((await send(h, o)).status, 429)
  })

  it('the per-instance send cap is NOT incremented by requests that fail Turnstile', async () => {
    const limiter = createRateLimiter({ perIp: 1000, sendCap: 2 })
    const failing = makeHarness(prodEnv(), { turnstile: { success: false } }, { rateLimiter: limiter })
    for (let i = 0; i < 20; i++) {
      assert.equal((await send(failing, { headers: { 'x-vercel-forwarded-for': `203.0.113.${i + 1}` } })).status, 403)
    }
    const good = makeHarness(prodEnv(), {}, { rateLimiter: limiter })
    assert.equal((await send(good, { headers: { 'x-vercel-forwarded-for': '198.51.100.9' } })).status, 200)
    assert.equal((await send(good, { headers: { 'x-vercel-forwarded-for': '198.51.100.10' } })).status, 200)
  })

  it('the per-instance send cap caps verified sends: the next one gets 429 + Retry-After', async () => {
    const limiter = createRateLimiter({ perIp: 1000, sendCap: 2 })
    const h = makeHarness(prodEnv(), {}, { rateLimiter: limiter })
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.1' } })).status, 200)
    assert.equal((await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.2' } })).status, 200)
    const res = await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.3' } })
    assert.equal(res.status, 429)
    assert.ok(Number(res.headers.get('retry-after')) >= 1)
    assert.equal(h.net.resendCalls().length, 2)
  })

  it('stores only salted hashes, never a raw network key', async () => {
    const limiter = createRateLimiter()
    const h = makeHarness(prodEnv(), {}, { rateLimiter: limiter })
    await send(h, { headers: { 'x-vercel-forwarded-for': '203.0.113.77' } })
    const keys = limiter.keys()
    assert.equal(keys.length, 1)
    assert.match(keys[0]!, /^[0-9a-f]{64}$/)
    assert.ok(!keys[0]!.includes('203'))
  })
})

describe('idempotency and Resend failures (step 12)', () => {
  it('reusing a key with the same payload produces one delivered email', async () => {
    const h = makeHarness(prodEnv(), { resend: { dedupe: true } })
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    assert.equal((await send(h, { idempotencyKey: key })).status, 200)
    assert.equal((await send(h, { idempotencyKey: key })).status, 200)
    assert.equal(h.net.resendCalls().length, 2, 'two requests reach Resend...')
    assert.equal(h.net.delivered(), 1, '...but only one email is delivered')
    assert.equal(h.net.resendCalls()[0]!.headers['idempotency-key'], h.net.resendCalls()[1]!.headers['idempotency-key'])
  })

  it('same key + same payload, retried later within the same minute, still delivers one email', async () => {
    let t = new Date('2026-10-28T14:03:05Z')
    const h = makeHarness(prodEnv(), { resend: { dedupe: true } }, { now: () => t })
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    assert.equal((await send(h, { idempotencyKey: key })).status, 200)
    t = new Date('2026-10-28T14:03:49Z')
    assert.equal((await send(h, { idempotencyKey: key })).status, 200)
    assert.equal(h.net.delivered(), 1)
    assert.equal(h.net.resendCalls()[0]!.body, h.net.resendCalls()[1]!.body, 'identical payloads')
  })

  it('reusing a key with a different payload gives 502 with no detail', async () => {
    const h = makeHarness(prodEnv(), { resend: { dedupe: true } })
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    assert.equal((await send(h, { idempotencyKey: key })).status, 200)
    const res = await send(h, { idempotencyKey: key, body: validBody({ description: 'A different description that is long enough to pass.' }) })
    assert.equal(res.status, 502)
    assert.deepEqual(JSON.parse(await check(res, ['amira@acmecoffee.example', 'invalid_idempotent'])), { ok: false, error: 'unavailable' })
    assert.equal(h.net.delivered(), 1)
  })

  it('Resend 4xx/5xx gives 502 with no vendor detail, and the log carries status + class name only', async () => {
    for (const status of [400, 401, 403, 409, 422, 429, 500, 503]) {
      const h = makeHarness(prodEnv(), {
        resend: { status, failureBody: JSON.stringify({ name: 'validation_error', message: 'bad address amira@acmecoffee.example ' + SENT_MARKER }) },
      })
      const res = await send(h)
      assert.equal(res.status, 502, String(status))
      assert.deepEqual(JSON.parse(await check(res, ['amira@acmecoffee.example', SENT_MARKER, 'validation_error'])), { ok: false, error: 'unavailable' })
      assert.deepEqual(JSON.parse(h.logs[0]!), { event: 'resend_error', errorName: 'MailError', httpStatus: status })
      assert.ok(!h.logs.join('').includes('acmecoffee') && !h.logs.join('').includes(SENT_MARKER))
    }
  })

  it('Resend network error and timeout give 502; the timeout is logged by name only', async () => {
    const net = makeHarness(prodEnv(), { resend: { throws: new TypeError('connect ECONNREFUSED ' + SENT_MARKER) } })
    const r1 = await send(net)
    assert.equal(r1.status, 502)
    await check(r1, [SENT_MARKER])
    assert.deepEqual(JSON.parse(net.logs[0]!), { event: 'resend_error', errorName: 'TypeError' })
    const to = makeHarness(prodEnv(), { resend: { throws: new DOMException('x ' + SENT_MARKER, 'TimeoutError') } })
    const r2 = await send(to)
    assert.equal(r2.status, 502)
    assert.deepEqual(to.logs, ['{"event":"resend_timeout"}'])
  })

  it('a Resend 200 without an id is a failure (success only on a confirmed send)', async () => {
    const h = makeHarness(prodEnv())
    const net = h.net
    const original = net.fetch
    h.deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('https://api.resend.com/')) return new Response('{}', { status: 200 })
      return original(input, init)
    }) as typeof fetch
    assert.equal((await send(h)).status, 502)
  })

  it('an unexpected exception returns the generic 500 and never reaches the response or the log', async () => {
    const h = makeHarness(prodEnv(), {}, {
      now: () => {
        throw new Error('boom ' + SENT_MARKER)
      },
    })
    const res = await send(h)
    assert.equal(res.status, 500)
    assert.deepEqual(JSON.parse(await check(res, [SENT_MARKER, 'boom'])), { ok: false, error: 'server' })
    assert.deepEqual(h.logs, ['{"event":"unhandled_error","errorName":"Error"}'])
  })
})

describe('header injection and escaping in every text field', () => {
  const FIELDS = ['name', 'phone', 'business_name', 'description', 'links', 'referral_source', 'email'] as const

  for (const [pname, payload] of Object.entries(INJECTION_PAYLOADS)) {
    for (const field of FIELDS) {
      it(`${pname} in ${field}: fixed key set, one recipient, clean subject`, async () => {
        const h = makeHarness(prodEnv())
        let value: string = payload
        if (field === 'description') value = 'Real project text. ' + payload + ' More project text here.'
        if (field === 'email') value = 'a' + payload + '@example.com'
        const res = await send(h, { body: validBody({ [field]: value }) })
        await check(res)
        assert.ok([200, 422].includes(res.status), 'status ' + res.status)
        if (res.status === 200) {
          assertFixedResend(h.net, REAL_INBOX)
          const p = resendPayload(h.net)
          assert.ok(!(p.text as string).includes('\r'), 'no CR in the text part')
          assert.doesNotMatch(p.text as string, new RegExp('[' + u(0x2028) + u(0x2029) + u(0x85) + u(0) + ']'))
          // No header lines were smuggled into the Resend call.
          assert.deepEqual(Object.keys(h.net.resendCalls()[0]!.headers).sort(), ['authorization', 'content-type', 'idempotency-key'])
        } else {
          assert.equal(h.net.calls.length, 0)
        }
      })
    }
  }

  it('injection in the business name cannot reach the subject as CR/LF; subject is capped', async () => {
    const h = makeHarness(prodEnv())
    await send(h, { body: validBody({ business_name: 'Acme' + CRLF + 'Bcc: attacker@example.test' + u(0x2028) + 'x'.repeat(60) }) })
    const subject = resendPayload(h.net).subject as string
    assert.doesNotMatch(subject, /[\p{Cc}\p{Zl}\p{Zp}]/u)
    assert.ok(Array.from(subject).length <= 150)
    assert.match(subject, /^New service request: Website, Logo - Acme Bcc: attacker@example\.test/)
    assert.ok(subject.endsWith(String.fromCharCode(0x2026)), 'long business name is cut with an ellipsis')
  })

  it('HTML is escaped: after removing the template tags no < or > survives from user input', async () => {
    const evil = `<script>alert(1)</script>&"'<img src=x onerror=alert(1)>`
    const h = makeHarness(prodEnv())
    const res = await send(h, {
      body: validBody({
        name: evil,
        phone: '',
        business_name: evil,
        referral_source: evil,
        description: 'Project: ' + evil + ' and more words so that it is long enough.',
        links: 'example.com/' + encodeURIComponent('<b>'),
      }),
    })
    assert.equal(res.status, 200)
    const html = resendPayload(h.net).html as string
    const stripped = html
      .replace(/<!doctype html>/i, '')
      .replace(/<\/?(?:html|head|meta|body|table|tr|td|div|br)\b[^>]*>/gi, '')
    assert.ok(!stripped.includes('<'), 'a user "<" survived')
    assert.ok(!stripped.includes('>'), 'a user ">" survived')
    assert.ok(stripped.includes('&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#39;'))
    assert.ok(!html.includes('<a '), 'no anchors')
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('<img'))
  })

  it('a 2000-character unbroken string is accepted and rendered as text', async () => {
    const h = makeHarness(prodEnv())
    const res = await send(h, { body: validBody({ description: 'W'.repeat(2000) }) })
    assert.equal(res.status, 200)
    assert.ok((resendPayload(h.net).html as string).includes('W'.repeat(2000)))
  })
})

describe('email content through the handler', () => {
  it('carries no IP, user agent, referrer or Origin in either part', async () => {
    const h = makeHarness(prodEnv())
    await send(h, {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.99',
        'x-forwarded-for': '198.51.100.99',
        'user-agent': 'UA-MARKER-5521',
        referer: 'https://ref.example/REF-MARKER-5521',
      },
    })
    const p = resendPayload(h.net)
    for (const part of [p.text as string, p.html as string, p.subject as string]) {
      for (const needle of ['203.0.113.99', '198.51.100.99', 'UA-MARKER', 'REF-MARKER', 'ref.example', 'https://www.inspirebusinesstechnology.com']) {
        assert.ok(!part.includes(needle), 'leaked ' + needle)
      }
    }
  })

  it('the text part starts with the untrusted-content notice and the privacy note version is printed', async () => {
    const h = makeHarness(prodEnv())
    await send(h)
    const p = resendPayload(h.net)
    assert.equal((p.text as string).split('\n')[0], 'Untrusted content from a website visitor. Do not open links you did not expect.')
    assert.match(p.text as string, /Privacy note version: \d{4}-\d{2}-\d{2}/)
    assert.match(p.html as string, /Privacy note version/)
    assert.match(p.text as string, new RegExp('UTC: +' + FIXED_NOW.toISOString().slice(0, 10)))
  })
})

describe('logs never contain a submitted value', () => {
  it('across success, validation, honeypot, turnstile and resend failures', async () => {
    const marker = { name: 'Name' + SENT_MARKER, email: 'e' + SENT_MARKER.toLowerCase() + '@leaky.example', business_name: 'Biz' + SENT_MARKER, description: 'Desc ' + SENT_MARKER + ' long enough to pass the minimum.', referral_source: 'Ref' + SENT_MARKER }
    const scenarios: Array<[string, Harness]> = [
      ['success', makeHarness(prodEnv())],
      ['turnstile fail', makeHarness(prodEnv(), { turnstile: { success: false } })],
      ['turnstile mismatch', makeHarness(prodEnv(), { turnstile: { hostname: 'evil.example' } })],
      ['turnstile down', makeHarness(prodEnv(), { turnstile: { throws: new TypeError(SENT_MARKER) } })],
      ['resend 500', makeHarness(prodEnv(), { resend: { status: 500, failureBody: SENT_MARKER } })],
      ['resend throw', makeHarness(prodEnv(), { resend: { throws: new Error(SENT_MARKER) } })],
      ['honeypot', makeHarness(prodEnv())],
      ['validation', makeHarness(prodEnv())],
    ]
    for (const [label, h] of scenarios) {
      const body = label === 'honeypot' ? validBody({ ...marker, homepage_url: SENT_MARKER }) : label === 'validation' ? validBody({ ...marker, consent: false }) : validBody(marker)
      await send(h, { body, headers: { 'x-vercel-forwarded-for': '203.0.113.50', 'user-agent': 'UA-' + SENT_MARKER } })
      const all = h.logs.join('\n')
      for (const needle of [SENT_MARKER, 'leaky.example', '203.0.113.50', 'UA-', 'inspirebusinesstechnology.com', 'test-resend-key', 'test-turnstile-prod-secret']) {
        assert.ok(!all.includes(needle), `${label}: log leaked ${needle}`)
      }
      for (const line of h.logs) {
        const ev = JSON.parse(line) as { event: string }
        assert.ok(['sent', 'honeypot', 'turnstile_failed', 'turnstile_mismatch', 'turnstile_unreachable', 'resend_error', 'resend_timeout', 'rate_limited', 'ip_header_missing'].includes(ev.event), label + ': ' + ev.event)
      }
    }
  })
})

describe('configuration guards through the handler', () => {
  it('missing variables give a generic 500 and a names-only log', async () => {
    const env = prodEnv()
    delete env.RESEND_API_KEY
    delete env.MAIL_TO
    const h = makeHarness(env)
    const res = await send(h)
    assert.equal(res.status, 500)
    assert.deepEqual(JSON.parse(await check(res)), { ok: false, error: 'server' })
    assert.deepEqual(JSON.parse(h.logs[0]!), { event: 'config_missing', names: ['MAIL_TO', 'RESEND_API_KEY'] })
    assert.equal(h.net.calls.length, 0)
  })

  it('MAIL_TRANSPORT=log on Vercel is refused', async () => {
    for (const env of [prodEnv({ MAIL_TRANSPORT: 'log' }), previewEnv({ MAIL_TRANSPORT: 'log' })]) {
      const h = makeHarness(env)
      const res = await send(h, { origin: 'https://site-abc123-team.vercel.app' })
      assert.equal(res.status, 500)
      assert.equal(h.net.calls.length, 0)
    }
  })

  it('preview + real inbox is refused unless PREVIEW_ALLOW_REAL_INBOX=1', async () => {
    const o = { origin: 'https://site-abc123-team.vercel.app' }
    const refused = makeHarness(previewEnv({ MAIL_TO: REAL_INBOX }))
    const res = await send(refused, o)
    assert.equal(res.status, 500)
    assert.equal(refused.net.calls.length, 0)
    assert.ok(refused.logs.some((l) => l.includes('preview_real_inbox_refused')))
    for (const flag of ['0', 'true', 'yes', '']) {
      const h = makeHarness(previewEnv({ MAIL_TO: REAL_INBOX, PREVIEW_ALLOW_REAL_INBOX: flag }))
      assert.equal((await send(h, o)).status, 500, 'flag ' + flag)
    }
    const allowed = makeHarness(previewEnv({ MAIL_TO: REAL_INBOX, PREVIEW_ALLOW_REAL_INBOX: '1' }))
    assert.equal((await send(allowed, o)).status, 200)
    assert.deepEqual(resendPayload(allowed.net).to, [REAL_INBOX])
    const sink = makeHarness(previewEnv())
    assert.equal((await send(sink, o)).status, 200)
    assert.deepEqual(resendPayload(sink.net).to, ['delivered@resend.dev'])
  })

  it('a case variant of the real inbox is also refused on preview', async () => {
    const h = makeHarness(previewEnv({ MAIL_TO: 'INFO@InspireBusinessTechnology.com' }))
    assert.equal((await send(h, { origin: 'https://site-abc123-team.vercel.app' })).status, 500)
  })
})
