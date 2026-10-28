import {
  API_PATH,
  IDEMPOTENCY_HEADER,
  type ApiFieldError,
  type WireRequest,
} from "@shared/serviceRequest"

// Client for POST /api/service-request. It returns a discriminated Outcome and
// never exposes server text: the UI renders its own strings (COPY.md).

export type Outcome =
  | { kind: "success"; id?: string }
  | { kind: "field_errors"; errors: ApiFieldError[] }
  | { kind: "too_large" }
  | { kind: "verification" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "server_error" }
  | { kind: "offline" }
  | { kind: "unknown" }

export const REQUEST_TIMEOUT_MS = 15000
const DEFAULT_RETRY_AFTER = 30

/** Fallback for non-secure origins where crypto.randomUUID is missing. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"))
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parseFieldErrors(v: unknown): ApiFieldError[] {
  if (!Array.isArray(v)) return []
  const out: ApiFieldError[] = []
  for (const e of v.slice(0, 20)) {
    if (isRecord(e) && typeof e.field === "string" && typeof e.code === "string") {
      out.push({ field: e.field, code: e.code } as ApiFieldError)
    }
  }
  return out
}

const MAX_RETRY_AFTER = 3600

/**
 * Retry-After is delta-seconds or an HTTP-date (RFC 9110). Anything else, or a missing
 * header, falls back to 30 s. Clamped to 1..3600 s. Exported for the quick check.
 */
export function parseRetryAfter(h: string | null, now: number = Date.now()): number {
  const v = h?.trim() ?? ""
  let secs = NaN
  if (/^\d+$/.test(v)) secs = Number.parseInt(v, 10)
  else if (v) {
    const t = Date.parse(v)
    if (Number.isFinite(t)) secs = Math.ceil((t - now) / 1000)
  }
  if (!Number.isFinite(secs)) return DEFAULT_RETRY_AFTER
  return Math.min(MAX_RETRY_AFTER, Math.max(1, secs))
}

/** A reference id is shown only if it looks like one: never arbitrary server text. */
function safeId(v: unknown): string | undefined {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,32}$/.test(v) ? v : undefined
}

export async function sendServiceRequest(
  wire: WireRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<Outcome> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)
  // One timer covers the fetch and the body read.
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: JSON.stringify(wire),
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    })

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    const rec = isRecord(body) ? body : null
    const slug = rec && typeof rec.error === "string" ? rec.error : ""

    if (res.status === 200) {
      return rec && rec.ok === true ? { kind: "success", id: safeId(rec.id) } : { kind: "unknown" }
    }
    if (res.status === 422 && slug === "validation") {
      return { kind: "field_errors", errors: parseFieldErrors(rec?.errors) }
    }
    if (res.status === 413) return { kind: "too_large" }
    if (res.status === 403 && slug === "verification_failed") return { kind: "verification" }
    if (res.status === 429) {
      return { kind: "rate_limited", retryAfterSeconds: parseRetryAfter(res.headers.get("Retry-After")) }
    }
    if (res.status >= 400 && res.status <= 599) return { kind: "server_error" }
    return { kind: "unknown" }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { kind: "unknown" }
    // fetch throws TypeError when there is no connection (or the request is blocked).
    return navigator.onLine === false ? { kind: "offline" } : { kind: "unknown" }
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}
