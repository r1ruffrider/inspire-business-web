/**
 * Request guards: Origin (T7), streamed body cap (T13), client key and in-memory rate limiter
 * (T11, ARCHITECTURE 5).
 *
 * The limiter is a SPEED BUMP, never a guarantee: each serverless instance has its own memory.
 */
import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import type { Config } from './config.js'

// ---------------------------------------------------------------------------
// Origin (T7)
// ---------------------------------------------------------------------------

const LOCALHOST_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/

/**
 * `origin` is the raw header value (null when the header is absent). It is compared with ===
 * against the allowlist. Not parsed, not lowercased, no endsWith/includes/startsWith, no
 * Referer fallback. The literal "null" is simply not in the set.
 */
export function checkOrigin(origin: string | null, config: Config): boolean {
  if (origin === null) return false
  if (origin.length > 300) return false
  if (config.allowedOrigins.has(origin)) return true
  return config.allowLocalhost && LOCALHOST_ORIGIN.test(origin)
}

// ---------------------------------------------------------------------------
// Bounded JSON body (T13)
// ---------------------------------------------------------------------------

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }

/**
 * Reads the body chunk by chunk with a running byte counter and aborts the moment it passes
 * `maxBytes`. Never request.json()/text()/arrayBuffer() on an unbounded body.
 * Content-Length is only a cheap pre-check: a missing, chunked or lying value is still bounded
 * by the counter.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = request.headers.get('content-length')
  if (declared !== null && /^[0-9]{1,15}$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, status: 413 }
  }
  if (request.body === null) return { ok: false, status: 400 }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        // Stop reading; do not wait for the rest of the stream.
        reader.cancel().catch(() => undefined)
        return { ok: false, status: 413 }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400 }
  }

  const buffer = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buffer.set(c, offset)
    offset += c.byteLength
  }

  try {
    // ignoreBOM: true keeps a leading UTF-8 BOM in the string, so JSON.parse fails on it and the
    // body is the same generic 400 as any other malformed body (A-16). fatal: true keeps invalid
    // UTF-8 a 400.
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer)
    const parsed: unknown = JSON.parse(text)
    // The caught error is discarded: its message can quote the body. This also catches the
    // RangeError that deeply nested JSON can raise.
    return { ok: true, value: parsed }
  } catch {
    return { ok: false, status: 400 }
  }
}

// ---------------------------------------------------------------------------
// Client key (T11)
// ---------------------------------------------------------------------------

export interface ClientKey {
  /** Normalised network key, e.g. "203.0.113.7", "v6/64:2001:db8:0:1" or "unknown". */
  key: string
  /** True when running on Vercel and x-vercel-forwarded-for was missing (log ip_header_missing). */
  headerMissing: boolean
}

function expandIPv6(input: string): number[] | null {
  let s = input
  const zone = s.indexOf('%')
  if (zone !== -1) s = s.slice(0, zone)
  // Embedded IPv4 tail (::ffff:1.2.3.4): convert to two hextets.
  const lastColon = s.lastIndexOf(':')
  const tail = s.slice(lastColon + 1)
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null
    const o = tail.split('.').map(Number)
    s =
      s.slice(0, lastColon + 1) +
      (((o[0] as number) << 8) | (o[1] as number)).toString(16) +
      ':' +
      (((o[2] as number) << 8) | (o[3] as number)).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' || halves[0] === undefined ? [] : halves[0].split(':')
  const rest = halves.length === 2 ? ((halves[1] ?? '') === '' ? [] : (halves[1] as string).split(':')) : []
  let groups: string[]
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length
    if (fill < 1) return null
    groups = [...head, ...new Array<string>(fill).fill('0'), ...rest]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

/** IPv4 as is; IPv4-mapped IPv6 as IPv4; other IPv6 keyed on its /64 prefix. */
export function normalizeIp(raw: string): string | null {
  const text = raw.trim()
  if (text.length === 0 || text.length > 64) return null
  const withoutZone = text.split('%')[0] as string
  const family = isIP(withoutZone)
  if (family === 4) return withoutZone
  if (family === 6) {
    const g = expandIPv6(withoutZone)
    if (g === null) return null
    // ::ffff:a.b.c.d  (first five groups zero, sixth 0xffff)
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
      const a = g[6] as number
      const b = g[7] as number
      return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`
    }
    return 'v6/64:' + g.slice(0, 4).map((x) => x.toString(16)).join(':')
  }
  return null
}

/**
 * On Vercel read ONLY x-vercel-forwarded-for; if it is missing, every such request shares the
 * single "unknown" bucket. Never fall back to x-forwarded-for there.
 * Off Vercel (dev, tests): first x-forwarded-for entry, else the socket address from the dev plugin.
 */
export function clientKey(request: Request, config: Config, remoteAddress?: string): ClientKey {
  if (config.isVercel) {
    const header = request.headers.get('x-vercel-forwarded-for')
    if (header === null || header.trim() === '') return { key: 'unknown', headerMissing: true }
    const first = (header.split(',')[0] ?? '').trim()
    return { key: normalizeIp(first) ?? 'unknown', headerMissing: false }
  }
  const xff = request.headers.get('x-forwarded-for')
  if (xff !== null && xff.trim() !== '') {
    const first = (xff.split(',')[0] ?? '').trim()
    const n = normalizeIp(first)
    if (n !== null) return { key: n, headerMissing: false }
  }
  if (remoteAddress !== undefined) {
    const n = normalizeIp(remoteAddress)
    if (n !== null) return { key: n, headerMissing: false }
  }
  return { key: 'unknown', headerMissing: false }
}

// ---------------------------------------------------------------------------
// Rate limiter (ARCHITECTURE 5.2)
// ---------------------------------------------------------------------------

export type LimitResult = { ok: true } | { ok: false; retryAfter: number }

export interface RateLimiter {
  /** Per-network-key limit. Check AND increment, synchronously. Called before Turnstile. */
  checkIp(key: string, nowMs: number): LimitResult
  /** Per-instance total of real sends. Call ONLY after Turnstile passed. Check AND increment, synchronously. */
  checkSend(nowMs: number): LimitResult
  /** Stored (hashed) keys. For tests: proves no raw network key is retained. */
  keys(): string[]
}

export interface RateLimiterOptions {
  windowMs?: number
  perIp?: number
  sendCap?: number
  maxKeys?: number
  /** Test hook. Default: 16 random bytes generated per limiter, never persisted. */
  salt?: Uint8Array
}

function retryAfterSeconds(oldest: number, nowMs: number, windowMs: number): number {
  const seconds = Math.ceil((oldest + windowMs - nowMs) / 1000)
  return Math.min(Math.max(seconds, 1), Math.ceil(windowMs / 1000))
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? 10 * 60 * 1000
  const perIp = options.perIp ?? 5
  const sendCap = options.sendCap ?? 40
  const maxKeys = options.maxKeys ?? 2000
  const salt = options.salt ?? randomBytes(16)
  const hits = new Map<string, number[]>()
  let sends: number[] = []

  function prune(nowMs: number): void {
    const cutoff = nowMs - windowMs
    for (const [k, list] of hits) {
      const kept = list.filter((t) => t > cutoff)
      if (kept.length === 0) hits.delete(k)
      else if (kept.length !== list.length) hits.set(k, kept)
    }
  }

  return {
    checkIp(key, nowMs) {
      // No await anywhere in this function: check and increment are one atomic step.
      const hashed = createHash('sha256').update(salt).update(key).digest('hex')
      prune(nowMs)
      const list = hits.get(hashed) ?? []
      if (list.length >= perIp) {
        return { ok: false, retryAfter: retryAfterSeconds(list[0] as number, nowMs, windowMs) }
      }
      if (!hits.has(hashed) && hits.size >= maxKeys) {
        // Evict the oldest-inserted key. Speed bump, not a guarantee.
        const oldest = hits.keys().next()
        if (oldest.done !== true) hits.delete(oldest.value)
      }
      list.push(nowMs)
      hits.set(hashed, list)
      return { ok: true }
    },
    checkSend(nowMs) {
      const cutoff = nowMs - windowMs
      sends = sends.filter((t) => t > cutoff)
      if (sends.length >= sendCap) {
        return { ok: false, retryAfter: retryAfterSeconds(sends[0] as number, nowMs, windowMs) }
      }
      sends.push(nowMs)
      return { ok: true }
    },
    keys() {
      return [...hits.keys()]
    },
  }
}
