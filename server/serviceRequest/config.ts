/**
 * readConfig(env): every configuration guard lives here (ARCHITECTURE 4.10, THREAT-MODEL T6,
 * T7, T9, preview rule). A serverless function has no startup, so "refuse to start" is
 * implemented as "every request returns the generic 500".
 *
 * Failures carry variable NAMES only, never values.
 */
import { isValidAsciiEmail } from '../../shared/serviceRequest.js'

export type Env = Record<string, string | undefined>

/** The company inbox. Hard-coded on purpose: it is what the preview guard protects. */
export const PRODUCTION_INBOX = 'info@inspirebusinesstechnology.com'
/** Every address on this domain (or a subdomain) counts as "the real inbox" on a preview. */
export const COMPANY_DOMAIN = 'inspirebusinesstechnology.com'
/** Production MAIL_FROM must be on this subdomain (protects the root domain's reputation). */
export const PRODUCTION_SEND_DOMAIN = 'send.inspirebusinesstechnology.com'

/**
 * Cloudflare's documented Turnstile TEST secrets (public values, not secrets).
 * VERIFY (Valentina/Natalia) against https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 * since this could not be confirmed offline.
 */
export const TURNSTILE_TEST_SECRETS: readonly string[] = [
  '1x0000000000000000000000000000000AA', // always passes
  '2x0000000000000000000000000000000AA', // always fails
  '3x0000000000000000000000000000000AA', // token already spent
]

export interface Config {
  isVercel: boolean
  isProduction: boolean
  isPreview: boolean
  mailFrom: string
  mailTo: string
  mailTransport: 'resend' | 'log'
  resendApiKey: string
  turnstileSecret: string
  /** Exact origin strings compared with ===. */
  allowedOrigins: ReadonlySet<string>
  /** Hostnames derived from allowedOrigins (used by the production Turnstile hostname check). */
  allowedHostnames: ReadonlySet<string>
  /** Localhost origins (anchored regex) are accepted only when VERCEL is unset. */
  allowLocalhost: boolean
}

export interface ConfigProblem {
  event: 'config_missing' | 'config_invalid' | 'preview_real_inbox_refused'
  names: string[]
}

export type ConfigResult =
  | { ok: true; config: Config }
  | { ok: false; problems: ConfigProblem[] }

const ORIGIN_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::[0-9]{1,5})?$/
const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/
const MAIL_FROM_RE = /^([A-Za-z0-9][A-Za-z0-9 .,&'-]{0,59}) <([^<>\s]{3,254})>$/

function present(env: Env, key: string): string | undefined {
  const v = env[key]
  return typeof v === 'string' && v !== '' ? v : undefined
}

function validOrigin(value: string): boolean {
  return value.length <= 260 && !value.includes('..') && ORIGIN_RE.test(value)
}

function hostOf(origin: string): string {
  return origin.slice('https://'.length).replace(/:[0-9]+$/, '')
}

/** MAIL_TO must be exactly one plain address: no list, no display name, no whitespace or CR/LF. */
function validMailTo(value: string): boolean {
  if (value.length > 254) return false
  return isValidAsciiEmail(value)
}

function parseMailFrom(value: string): { address: string } | null {
  if (value.length > 400) return null
  const m = MAIL_FROM_RE.exec(value)
  if (m === null) return null
  const address = m[2] as string
  return isValidAsciiEmail(address) ? { address } : null
}

/**
 * True for any address on the company domain or a subdomain of it (case-insensitive, so it also
 * covers plus-addressing like info+x@). Used by the preview guard (SECURITY-REVIEW S1).
 */
export function isCompanyDomainAddress(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
  return domain === COMPANY_DOMAIN || domain.endsWith('.' + COMPANY_DOMAIN)
}

export function readConfig(env: Env): ConfigResult {
  const missing: string[] = []
  const invalid: string[] = []
  const problems: ConfigProblem[] = []

  const isVercel = present(env, 'VERCEL') !== undefined
  const rawVercelEnv = present(env, 'VERCEL_ENV')
  let isProduction = false
  let isPreview = false
  if (isVercel) {
    if (rawVercelEnv === 'production') isProduction = true
    else if (rawVercelEnv === 'preview') isPreview = true
    else invalid.push('VERCEL_ENV') // unknown (or missing) VERCEL_ENV on Vercel is rejected
  }

  // Transport.
  const rawTransport = present(env, 'MAIL_TRANSPORT')
  let mailTransport: 'resend' | 'log' = 'resend'
  if (rawTransport === undefined || rawTransport === 'resend') {
    mailTransport = 'resend'
  } else if (rawTransport === 'log') {
    mailTransport = 'log'
    if (isVercel) invalid.push('MAIL_TRANSPORT') // never swallow leads or write PII to Vercel logs
  } else {
    invalid.push('MAIL_TRANSPORT')
  }

  // Required variables.
  const turnstileSecret = present(env, 'TURNSTILE_SECRET_KEY')
  const mailFrom = present(env, 'MAIL_FROM')
  const mailTo = present(env, 'MAIL_TO')
  const resendApiKey = present(env, 'RESEND_API_KEY')
  if (turnstileSecret === undefined) missing.push('TURNSTILE_SECRET_KEY')
  if (mailFrom === undefined) missing.push('MAIL_FROM')
  if (mailTo === undefined) missing.push('MAIL_TO')
  if (mailTransport === 'resend' && resendApiKey === undefined) missing.push('RESEND_API_KEY')

  // Turnstile secret: a documented test secret is invalid in production.
  if (isProduction && turnstileSecret !== undefined && TURNSTILE_TEST_SECRETS.includes(turnstileSecret)) {
    invalid.push('TURNSTILE_SECRET_KEY')
  }

  // MAIL_TO: exactly one valid address.
  if (mailTo !== undefined && !validMailTo(mailTo)) invalid.push('MAIL_TO')

  // MAIL_FROM: `Display Name <addr>`; production address must be on the sending subdomain.
  if (mailFrom !== undefined) {
    const parsed = parseMailFrom(mailFrom)
    if (parsed === null) {
      invalid.push('MAIL_FROM')
    } else if (isProduction) {
      const domain = parsed.address.slice(parsed.address.indexOf('@') + 1).toLowerCase()
      if (domain !== PRODUCTION_SEND_DOMAIN) invalid.push('MAIL_FROM')
    }
  }

  // Origins.
  const allowedOrigins = new Set<string>()
  const rawOrigins = present(env, 'ALLOWED_ORIGINS')
  if (rawOrigins !== undefined) {
    if (rawOrigins.length > 2000) {
      invalid.push('ALLOWED_ORIGINS')
    } else {
      for (const entry of rawOrigins.split(',')) {
        const o = entry.trim()
        if (o === '') continue
        if (validOrigin(o)) allowedOrigins.add(o)
        else {
          invalid.push('ALLOWED_ORIGINS')
          break
        }
      }
    }
  }
  if (isProduction && rawOrigins === undefined) missing.push('ALLOWED_ORIGINS')
  if (isProduction && rawOrigins !== undefined && allowedOrigins.size === 0 && !invalid.includes('ALLOWED_ORIGINS')) {
    missing.push('ALLOWED_ORIGINS')
  }
  // Preview deployments: this deployment and its stable branch alias only. A missing or empty
  // variable is skipped (no "https://undefined"). VERCEL_URL is never added in production.
  if (isPreview) {
    for (const key of ['VERCEL_BRANCH_URL', 'VERCEL_URL']) {
      const host = present(env, key)
      if (host !== undefined && host.length <= 253 && !host.includes('..') && HOST_RE.test(host)) {
        allowedOrigins.add('https://' + host)
      }
    }
  }

  // Preview rule (BLOCKER): a preview must not deliver to the real inbox unless explicitly allowed.
  if (
    isPreview &&
    mailTo !== undefined &&
    isCompanyDomainAddress(mailTo) &&
    present(env, 'PREVIEW_ALLOW_REAL_INBOX') !== '1'
  ) {
    problems.push({ event: 'preview_real_inbox_refused', names: ['MAIL_TO'] })
    invalid.push('MAIL_TO')
  }

  if (missing.length > 0) problems.push({ event: 'config_missing', names: [...new Set(missing)] })
  if (invalid.length > 0) problems.push({ event: 'config_invalid', names: [...new Set(invalid)] })
  if (problems.length > 0) return { ok: false, problems }

  const allowedHostnames = new Set<string>()
  for (const o of allowedOrigins) allowedHostnames.add(hostOf(o))

  return {
    ok: true,
    config: {
      isVercel,
      isProduction,
      isPreview,
      mailFrom: mailFrom as string,
      mailTo: mailTo as string,
      mailTransport,
      resendApiKey: resendApiKey ?? '',
      turnstileSecret: turnstileSecret as string,
      allowedOrigins,
      allowedHostnames,
      allowLocalhost: !isVercel,
    },
  }
}
