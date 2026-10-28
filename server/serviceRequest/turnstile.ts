/**
 * Cloudflare Turnstile siteverify (ARCHITECTURE 4.7, THREAT-MODEL T9). Fails closed.
 *
 *  - Token pre-check (string, 1..2048 chars) before ANY outbound call.
 *  - Secret and token go in the POST body, never in a URL.
 *  - No remoteip, no user data as cData.
 *  - 3 s timeout.
 *  - Production passes only with success === true AND hostname in the allowed set AND
 *    action === 'service-request'. Preview and local pass on success alone.
 *
 * VERIFY (Valentina/Natalia): response field names (success, hostname, action, error-codes)
 * against Cloudflare's current docs; they could not be confirmed offline.
 */
import { TURNSTILE_ACTION, TURNSTILE_TOKEN_MAX_LENGTH } from '../../shared/serviceRequest.js'
import type { Logger } from './log.js'
import { errorNameOf } from './log.js'

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const TURNSTILE_TIMEOUT_MS = 3000

export type TurnstileOutcome =
  | { kind: 'ok' }
  | { kind: 'rejected' } // 403 verification_failed
  | { kind: 'unavailable' } // 503 unavailable
  | { kind: 'misconfigured' } // 500 server (our secret is wrong or missing)

export interface TurnstileParams {
  token: unknown
  secret: string
  production: boolean
  allowedHostnames: ReadonlySet<string>
  fetchFn: typeof fetch
  log: Logger
  timeoutMs?: number
}

export async function verifyTurnstile(p: TurnstileParams): Promise<TurnstileOutcome> {
  const { token } = p
  if (typeof token !== 'string' || token.length < 1 || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    p.log('turnstile_failed', { codes: ['missing-input-response'] })
    return { kind: 'rejected' }
  }

  let data: unknown
  try {
    const res = await p.fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: p.secret, response: token }).toString(),
      signal: AbortSignal.timeout(p.timeoutMs ?? TURNSTILE_TIMEOUT_MS),
    })
    if (!res.ok) {
      p.log('turnstile_unreachable', { httpStatus: res.status })
      return { kind: 'unavailable' }
    }
    data = await res.json()
  } catch (err) {
    p.log('turnstile_unreachable', { errorName: errorNameOf(err) })
    return { kind: 'unavailable' }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    p.log('turnstile_unreachable')
    return { kind: 'unavailable' }
  }
  const body = data as Record<string, unknown>

  if (body.success === true) {
    if (!p.production) return { kind: 'ok' }
    const hostOk = typeof body.hostname === 'string' && p.allowedHostnames.has(body.hostname)
    const actionOk = body.action === TURNSTILE_ACTION
    if (hostOk && actionOk) return { kind: 'ok' }
    p.log('turnstile_mismatch')
    return { kind: 'rejected' }
  }

  const codes = Array.isArray(body['error-codes'])
    ? (body['error-codes'] as unknown[]).filter((c): c is string => typeof c === 'string')
    : []
  if (codes.includes('internal-error')) {
    p.log('turnstile_unreachable')
    return { kind: 'unavailable' }
  }
  // Our own secret is wrong or missing: a config fault, not a visitor fault. Generic 500, and the
  // allowlisted config_invalid event (variable NAME only; the vendor response is never logged).
  if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
    p.log('config_invalid', { names: ['TURNSTILE_SECRET_KEY'] })
    return { kind: 'misconfigured' }
  }
  p.log('turnstile_failed', { codes })
  return { kind: 'rejected' }
}
