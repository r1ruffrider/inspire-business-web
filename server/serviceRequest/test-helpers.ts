/**
 * Shared helpers for the node:test files. Never imported by api/ or src/.
 * Invisible and line-terminator characters are built from code points here so that none is ever
 * pasted into a source file.
 */
import { randomUUID } from 'node:crypto'
import type { Env } from './config.ts'
import type { HandlerDeps } from './handler.ts'
import { createRateLimiter } from './guards.ts'

export const PROD_ORIGIN = 'https://www.inspirebusinesstechnology.com'
export const PROD_HOST = 'www.inspirebusinesstechnology.com'
export const REAL_INBOX = 'info@inspirebusinesstechnology.com'
export const FROM = 'Inspire Business Group <requests@send.inspirebusinesstechnology.com>'
export const FIXED_NOW = new Date('2026-10-28T14:03:22Z')

/** Code points to a string. */
export const u = (...codes: number[]): string => String.fromCodePoint(...codes)

export const CRLF = u(13, 10)

/** Header-injection and hiding payloads (THREAT-MODEL abuse cases). */
export const INJECTION_PAYLOADS: Record<string, string> = {
  crlf_bcc: 'x' + CRLF + 'Bcc: attacker@example.test',
  lf_subject: 'x' + u(10) + 'Subject: y',
  cr_only: 'x' + u(13) + 'Bcc: attacker@example.test',
  line_separator: 'x' + u(0x2028) + 'Bcc: attacker@example.test',
  paragraph_separator: 'x' + u(0x2029) + 'Bcc: attacker@example.test',
  nel: 'x' + u(0x85) + 'Bcc: attacker@example.test',
  percent_encoded: 'x%0d%0aBcc: attacker@example.test',
  nul: 'x' + u(0) + 'Bcc: attacker@example.test',
  bidi_override: 'x' + u(0x202e) + 'gnp.exe' + u(0x202c),
  bidi_isolates: u(0x2066, 0x2067, 0x2068, 0x2069) + 'x',
  arabic_letter_mark: u(0x061c) + 'x',
  tag_chars: 'x' + u(0xe0041, 0xe0042, 0xe007f),
  zero_width: 'x' + u(0x200b, 0xfeff, 0x00ad, 0x2060),
  mixed: 'x' + CRLF + 'Bcc: a@evil.test' + CRLF + 'To: b@evil.test' + CRLF + CRLF + 'body',
}

export function prodEnv(over: Env = {}): Env {
  return {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    RESEND_API_KEY: 'test-resend-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-prod-secret',
    MAIL_FROM: FROM,
    MAIL_TO: REAL_INBOX,
    ALLOWED_ORIGINS: PROD_ORIGIN,
    ...over,
  }
}

export function previewEnv(over: Env = {}): Env {
  return {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_BRANCH_URL: 'site-git-feature-pro-upgrade-team.vercel.app',
    VERCEL_URL: 'site-abc123-team.vercel.app',
    RESEND_API_KEY: 'test-resend-preview-key',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    MAIL_FROM: FROM,
    MAIL_TO: 'delivered@resend.dev',
    ...over,
  }
}

export function localEnv(over: Env = {}): Env {
  return {
    MAIL_TRANSPORT: 'log',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    MAIL_FROM: FROM,
    MAIL_TO: 'delivered@resend.dev',
    ...over,
  }
}

export function validBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Amira Haddad',
    email: 'amira@acmecoffee.example',
    phone: '',
    business_name: 'Acme Coffee Roasters',
    services: ['website', 'logo'],
    description: 'We sell roasted coffee online and need a new website and a logo for the bags.',
    links: 'acmecoffee.example',
    timeline: '1-3-months',
    referral_source: 'A friend who runs a bakery',
    consent: true,
    homepage_url: '',
    turnstile_token: 'tok-valid',
    ...over,
  }
}

export interface RequestOptions {
  method?: string
  origin?: string | null
  contentType?: string | null
  idempotencyKey?: string | null
  headers?: Record<string, string>
  body?: unknown
  rawBody?: string | Uint8Array | ReadableStream<Uint8Array> | null
}

export function makeRequest(o: RequestOptions = {}): Request {
  const method = o.method ?? 'POST'
  const headers = new Headers()
  const origin = o.origin === undefined ? PROD_ORIGIN : o.origin
  if (origin !== null) headers.set('origin', origin)
  const ct = o.contentType === undefined ? 'application/json' : o.contentType
  if (ct !== null) headers.set('content-type', ct)
  const key = o.idempotencyKey === undefined ? randomUUID() : o.idempotencyKey
  if (key !== null) headers.set('idempotency-key', key)
  // Vercel always supplies this; tests override it (an empty value means "missing").
  headers.set('x-vercel-forwarded-for', '203.0.113.1')
  for (const [k, v] of Object.entries(o.headers ?? {})) headers.set(k, v)
  let body: string | Uint8Array | ReadableStream<Uint8Array> | null = null
  if (method !== 'GET' && method !== 'HEAD') {
    if (o.rawBody !== undefined) body = o.rawBody
    else body = JSON.stringify(o.body === undefined ? validBody() : o.body)
  }
  const init: RequestInit & { duplex?: 'half' } = { method, headers }
  if (body !== null) {
    init.body = body
    if (typeof body !== 'string' && !(body instanceof Uint8Array)) init.duplex = 'half'
  }
  return new Request('http://localhost/api/service-request', init)
}

// ---------------------------------------------------------------------------
// Fake network (Turnstile siteverify and Resend). No real network is ever used.
// ---------------------------------------------------------------------------

export interface FakeCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  host: 'siteverify' | 'resend' | 'other'
}

export interface FakeNetworkOptions {
  turnstile?: {
    success?: boolean
    hostname?: string
    action?: string
    errorCodes?: string[]
    status?: number
    throws?: Error
    rawBody?: string
  }
  resend?: {
    status?: number
    id?: string
    throws?: Error
    /** Vendor body returned on failure. Deliberately echoes an address to prove it never leaks. */
    failureBody?: string
    /** Model Resend's Idempotency-Key semantics (same key + same payload = no new mail). */
    dedupe?: boolean
  }
}

export interface FakeNetwork {
  fetch: typeof fetch
  calls: FakeCall[]
  siteverifyCalls: () => FakeCall[]
  resendCalls: () => FakeCall[]
  /** Distinct emails that a real Resend would have delivered. */
  delivered: () => number
}

export function makeFakeNetwork(opts: FakeNetworkOptions = {}): FakeNetwork {
  const calls: FakeCall[] = []
  const seen = new Map<string, { payload: string; id: string }>()
  let delivered = 0
  let counter = 0

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v
    })
    const body = typeof init?.body === 'string' ? init.body : ''
    const host: FakeCall['host'] = url.startsWith('https://challenges.cloudflare.com/')
      ? 'siteverify'
      : url.startsWith('https://api.resend.com/')
        ? 'resend'
        : 'other'
    calls.push({ url, method: init?.method ?? 'GET', headers, body, host })

    if (host === 'siteverify') {
      const t = opts.turnstile ?? {}
      if (t.throws !== undefined) throw t.throws
      if (t.rawBody !== undefined) return new Response(t.rawBody, { status: t.status ?? 200 })
      if (t.status !== undefined && t.status >= 400) return new Response('{}', { status: t.status })
      const success = t.success ?? true
      const payload: Record<string, unknown> = { success }
      if (success) {
        payload.hostname = t.hostname ?? PROD_HOST
        payload.action = t.action ?? 'service-request'
        payload.challenge_ts = '2026-10-28T14:03:00Z'
      } else {
        payload['error-codes'] = t.errorCodes ?? ['invalid-input-response']
      }
      return new Response(JSON.stringify(payload), { status: 200 })
    }

    if (host === 'resend') {
      const r = opts.resend ?? {}
      if (r.throws !== undefined) throw r.throws
      if (r.status !== undefined && r.status >= 400) {
        return new Response(r.failureBody ?? '{"name":"internal_server_error","message":"upstream failure"}', {
          status: r.status,
        })
      }
      const key = headers['idempotency-key'] ?? ''
      if (r.dedupe === true) {
        const prior = seen.get(key)
        if (prior !== undefined) {
          if (prior.payload === body) return new Response(JSON.stringify({ id: prior.id }), { status: 200 })
          return new Response(
            JSON.stringify({ name: 'invalid_idempotent_request', message: 'payload differs for ' + 'amira@acmecoffee.example' }),
            { status: 409 },
          )
        }
      }
      counter += 1
      const id = r.id ?? 'fake-id-' + counter
      delivered += 1
      if (r.dedupe === true) seen.set(key, { payload: body, id })
      return new Response(JSON.stringify({ id }), { status: 200 })
    }

    throw new Error('unexpected outbound call in test: ' + url)
  }

  return {
    fetch: fakeFetch as typeof fetch,
    calls,
    siteverifyCalls: () => calls.filter((c) => c.host === 'siteverify'),
    resendCalls: () => calls.filter((c) => c.host === 'resend'),
    delivered: () => delivered,
  }
}

export interface Harness {
  deps: HandlerDeps
  net: FakeNetwork
  logs: string[]
}

export function makeHarness(
  env: Env,
  netOpts: FakeNetworkOptions = {},
  extra: Partial<HandlerDeps> = {},
): Harness {
  const net = makeFakeNetwork(netOpts)
  const logs: string[] = []
  const deps: HandlerDeps = {
    env,
    now: () => FIXED_NOW,
    fetch: net.fetch,
    rateLimiter: createRateLimiter({ perIp: 1000, sendCap: 1000 }),
    log: (line) => {
      logs.push(line)
    },
    mailLog: () => undefined,
    ...extra,
  }
  return { deps, net, logs }
}

/** Parses the JSON body of the (single) Resend call. */
export function resendPayload(net: FakeNetwork): Record<string, unknown> {
  const calls = net.resendCalls()
  if (calls.length !== 1) throw new Error('expected exactly one Resend call, saw ' + calls.length)
  return JSON.parse((calls[0] as FakeCall).body) as Record<string, unknown>
}

export async function readBody(res: Response): Promise<string> {
  return await res.text()
}
