/**
 * handleServiceRequest(request, deps): the one pure handler, used by the Vercel adapter, the Vite
 * dev middleware and node:test. Every side effect is injected.
 *
 * Order of checks (THREAT-MODEL section 3 item 1, ARCHITECTURE 4.2):
 *   config, method, content type, Origin, size+parse, shape, honeypot, validate,
 *   per-IP limit, Turnstile, per-instance send cap (after Turnstile), send.
 *
 * Every response: Cache-Control no-store, X-Content-Type-Options nosniff, JSON content type,
 * no CORS headers, no submitted value, no stack, no vendor name or error.
 */
import { randomUUID } from 'node:crypto'
import {
  checkWireShape,
  isIdempotencyKey,
  MAX_BODY_BYTES,
  validateServiceRequest,
} from '../../shared/serviceRequest.js'
import type { ApiFailure, ApiFieldError, ApiSuccess } from '../../shared/serviceRequest.js'
import { readConfig } from './config.js'
import type { Config, ConfigResult, Env } from './config.js'
import { composeEmail } from './email.js'
import { checkOrigin, clientKey, createRateLimiter, readJsonBody } from './guards.js'
import type { RateLimiter } from './guards.js'
import { consoleSink, createLogger, errorNameOf } from './log.js'
import type { LogSink } from './log.js'
import { logTransport, MailError, resendTransport } from './mail.js'
import type { MailTransport } from './mail.js'
import { verifyTurnstile } from './turnstile.js'

export interface HandlerDeps {
  env: Env
  now?: () => Date
  /** Used for Turnstile siteverify and the Resend call. */
  fetch?: typeof fetch
  transport?: MailTransport
  rateLimiter?: RateLimiter
  randomUUID?: () => string
  /** Log line sink. Default: console.log. */
  log?: LogSink
  /** Socket address, supplied by the dev plugin (off-Vercel fallback for the client key). */
  remoteAddress?: string
  /** Where the dev log transport prints the composed mail. Default: console.log. */
  mailLog?: (text: string) => void
}

const RESEND_TIMEOUT_MS = 5000

// One limiter per instance (module level), created on first use.
let defaultLimiter: RateLimiter | undefined
function instanceLimiter(): RateLimiter {
  defaultLimiter ??= createRateLimiter()
  return defaultLimiter
}

// Config is read once per env object (cached per instance).
const configCache = new WeakMap<Env, ConfigResult>()
function loadConfig(env: Env): ConfigResult {
  const cached = configCache.get(env)
  if (cached !== undefined) return cached
  const fresh = readConfig(env)
  configCache.set(env, fresh)
  return fresh
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function respond(
  status: number,
  body: ApiSuccess | ApiFailure,
  extra?: Record<string, string>,
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  if (extra !== undefined) {
    for (const [k, v] of Object.entries(extra)) headers.set(k, v)
  }
  return new Response(JSON.stringify(body), { status, headers })
}

const fail = (status: number, error: ApiFailure['error'], extra?: Record<string, string>): Response =>
  respond(status, { ok: false, error }, extra)

function isJsonContentType(value: string | null): boolean {
  if (value === null || value.length > 200) return false
  const media = (value.split(';')[0] as string).trim().toLowerCase()
  return media === 'application/json'
}

function referenceFrom(uuid: string): string {
  return 'SR-' + uuid.replace(/-/g, '').slice(0, 8).toUpperCase()
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleServiceRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const log = createLogger(deps.log ?? consoleSink)
  try {
    return await run(request, deps, log)
  } catch (err) {
    // Nothing thrown is ever echoed. Log the class name only.
    log('unhandled_error', { errorName: errorNameOf(err) })
    return fail(500, 'server')
  }
}

async function run(
  request: Request,
  deps: HandlerDeps,
  log: ReturnType<typeof createLogger>,
): Promise<Response> {
  const now = deps.now ?? (() => new Date())

  // 0. Config. Any failure: 500, names only in the log.
  const cfg = loadConfig(deps.env)
  if (!cfg.ok) {
    for (const problem of cfg.problems) log(problem.event, { names: problem.names })
    return fail(500, 'server')
  }
  const config: Config = cfg.config

  // 1. Method. OPTIONS is 405 too: there is no CORS.
  if (request.method !== 'POST') return fail(405, 'method', { Allow: 'POST' })

  // 2. Content type.
  if (!isJsonContentType(request.headers.get('content-type'))) return fail(415, 'unsupported')

  // 3. Origin (required, exact match), then Sec-Fetch-Site when present.
  if (!checkOrigin(request.headers.get('origin'), config)) return fail(403, 'forbidden')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== 'same-origin') return fail(403, 'forbidden')

  // 4 and 5. Bounded read, then parse.
  const body = await readJsonBody(request, MAX_BODY_BYTES)
  if (!body.ok) return fail(body.status, body.status === 413 ? 'too_large' : 'bad_request')

  // 6. Shape: plain object, allowlisted keys, honeypot is a string, services raw length <= 6,
  //    Idempotency-Key is a UUID v4.
  const shape = checkWireShape(body.value)
  if (!shape.ok) return fail(400, 'bad_request')
  const rawKey = request.headers.get('idempotency-key')
  if (!isIdempotencyKey(rawKey)) return fail(400, 'bad_request')
  const idempotencyKey = rawKey.toLowerCase()

  // 7. Honeypot: indistinguishable from success, nothing sent, fixed event name only.
  if (shape.honeypot.trim() !== '') {
    log('honeypot')
    return respond(200, { ok: true, id: referenceFrom((deps.randomUUID ?? randomUUID)()) })
  }

  // 8. Validate and normalise.
  const result = validateServiceRequest(body.value)
  if (!result.ok) {
    if (result.errors.some((e) => e.field === '_form')) return fail(400, 'bad_request')
    // Only { field, code } pairs from the fixed enums. No line, no count, no value.
    const errors: ApiFieldError[] = result.errors.map((e) => ({ field: e.field, code: e.code }))
    return respond(422, { ok: false, error: 'validation', errors })
  }

  // 9. Per-IP limit. Check AND increment synchronously (no await in between).
  const limiter = deps.rateLimiter ?? instanceLimiter()
  const client = clientKey(request, config, deps.remoteAddress)
  if (client.headerMissing) log('ip_header_missing')
  const ipLimit = limiter.checkIp(client.key, now().getTime())
  if (!ipLimit.ok) {
    log('rate_limited')
    return fail(429, 'rate_limited', { 'Retry-After': String(ipLimit.retryAfter) })
  }

  // 10. Turnstile (fails closed).
  const fetchFn = deps.fetch ?? globalThis.fetch
  const ts = await verifyTurnstile({
    token: shape.token,
    secret: config.turnstileSecret,
    production: config.isProduction,
    allowedHostnames: config.allowedHostnames,
    fetchFn,
    log,
  })
  if (ts.kind === 'rejected') return fail(403, 'verification_failed')
  if (ts.kind === 'unavailable') return fail(503, 'unavailable')
  if (ts.kind === 'misconfigured') return fail(500, 'server')

  // 11. Per-instance send cap: counted ONLY now that Turnstile has passed.
  const sendLimit = limiter.checkSend(now().getTime())
  if (!sendLimit.ok) {
    log('rate_limited')
    return fail(429, 'rate_limited', { 'Retry-After': String(sendLimit.retryAfter) })
  }

  // 12. Compose and send (5 s timeout). Any failure is a generic 502.
  const reference = referenceFrom(idempotencyKey)
  const message = composeEmail({
    value: result.value,
    reference,
    now: now(),
    from: config.mailFrom,
    to: config.mailTo,
    idempotencyKey: 'sr-' + idempotencyKey,
    production: config.isProduction,
  })
  const transport: MailTransport =
    deps.transport ??
    (config.mailTransport === 'log'
      ? logTransport(deps.mailLog ?? ((text) => console.log(text)))
      : resendTransport(config.resendApiKey, fetchFn))
  try {
    await transport.send(message, AbortSignal.timeout(RESEND_TIMEOUT_MS))
  } catch (err) {
    const name = errorNameOf(err)
    if (name === 'TimeoutError' || name === 'AbortError') {
      log('resend_timeout')
    } else {
      log('resend_error', {
        errorName: name,
        ...(err instanceof MailError && err.status !== null ? { httpStatus: err.status } : {}),
      })
    }
    return fail(502, 'unavailable')
  }

  // 13. Success only on a confirmed send.
  log('sent')
  return respond(200, { ok: true, id: reference })
}
