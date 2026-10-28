/**
 * Request services: the ONE validator, used by the browser and by the server.
 *
 * Rules for this file (ARCHITECTURE v2 section 2.1 and 3, THREAT-MODEL T1, T3a, T4, T13):
 *  - No DOM, no Node API, no environment access, no import from outside shared/.
 *  - Returns error CODES only. The UI owns every message string.
 *  - Every length check runs before any regex or Unicode-class operation on the same
 *    string, and every regex here is linear (no nested quantifiers).
 *  - The output object is built from the known field table only. No spread, no
 *    Object.assign, no lookup by a user-supplied key.
 *
 * Adding a field later (for example `budget`): add one entry to FIELDS below, plus one
 * labelled row in server/serviceRequest/email.ts. WIRE_KEYS, ServiceRequest, FieldName,
 * validateField and the unknown-key check all derive from the table.
 */

// ---------------------------------------------------------------------------
// Constants (frontend contract)
// ---------------------------------------------------------------------------

export const SERVICES = ['website', 'logo', 'branding'] as const
export const TIMELINES = ['asap', '1-3-months', 'flexible', 'unsure'] as const
export type Service = (typeof SERVICES)[number]
export type Timeline = (typeof TIMELINES)[number]

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  business_name: 120,
  description: { min: 20, max: 2000, maxUrls: 5 },
  links: { maxLines: 5, maxLineLength: 300 },
  referral_source: 200,
  servicesRawMax: 6,
} as const

/** Same-origin path of the function. */
export const API_PATH = '/api/service-request'
/** Header carrying the client-generated UUID v4 (header only, never a body field). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
/** Honeypot wire key. Send it on every submit; empty string when untouched. */
export const HONEYPOT_FIELD = 'homepage_url'
/** Turnstile token wire key. */
export const TURNSTILE_TOKEN_FIELD = 'turnstile_token'
/** The Turnstile widget `action` option MUST be exactly this (production siteverify checks it). */
export const TURNSTILE_ACTION = 'service-request'
/** Tokens longer than this are rejected before any outbound call. */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048
/** sessionStorage key for the form draft. The draft never holds consent, honeypot or token. */
export const DRAFT_STORAGE_KEY = 'rs-draft-v1'
/** Hard request body cap enforced by the server (bytes). */
export const MAX_BODY_BYTES = 32 * 1024
/**
 * Version of the privacy note text. Printed in every request email ("Privacy note version: ...") and
 * exported here so the page can show the same value next to the note. MUST be bumped by whoever
 * edits the note wording (COPY.md section 4 / PrivacyNote.tsx). Any edit changes the suffix.
 */
export const PRIVACY_NOTE_VERSION = '2026-10-28.2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid'
  | 'too_many'
  | 'bad_scheme'
  | 'not_allowed'

export interface FieldError {
  field: FieldName | '_form'
  code: ErrorCode
  /** 1-based, links only. Never sent by the server. */
  line?: number
  /** chars to add or remove, links to remove, or URLs to remove. Never sent by the server. */
  count?: number
}

type Fail = { code: ErrorCode; line?: number; count?: number }
type Parsed<T> = { ok: true; value: T } | { ok: false; fail: Fail }
interface FieldDef<T> {
  /** `gate` = apply the cheap raw-size bound before any regex (server). The client counter passes false to get exact counts. */
  parse(raw: unknown, gate: boolean): Parsed<T>
}

// ---------------------------------------------------------------------------
// Text pipeline (T1)
// ---------------------------------------------------------------------------

// Regex source escapes are built from numbers so no invisible character or line terminator is ever
// pasted into this source file.
const BS = String.fromCharCode(92)
const esc = (n: number): string => String.fromCharCode(92) + 'u' + n.toString(16).padStart(4, '0')

// Every Cf character is removed except U+200C, U+200D, U+200E, U+200F (ZWNJ, ZWJ, LRM, RLM).
// The Tag block is removed explicitly as well, because its unassigned code points are not Cf.
const STRIP_FORMAT = new RegExp('(?![' + esc(0x200c) + '-' + esc(0x200f) + '])[' + BS + 'p{Cf}' + BS + 'u{E0000}-' + BS + 'u{E007F}]', 'gu')
// Lone UTF-16 surrogates (with the u flag a lone surrogate is a single code point of category Cs).
const LONE_SURROGATE = /\p{Cs}/gu
// C0 (except LF in multi-line mode), DEL, C1, U+2028, U+2029. Tab and CR/LF handled below.
const CONTROLS_SINGLE = new RegExp('[' + esc(0) + '-' + esc(0x1f) + esc(0x7f) + '-' + esc(0x9f) + esc(0x2028) + esc(0x2029) + ']', 'g')
const CONTROLS_MULTI = new RegExp('[' + esc(0) + '-' + esc(9) + esc(0xb) + '-' + esc(0x1f) + esc(0x7f) + '-' + esc(0x9f) + esc(0x2028) + esc(0x2029) + ']', 'g')
const ANY_CONTROL_OR_FORMAT = new RegExp('[' + BS + 'p{Cc}' + BS + 'p{Cf}' + esc(0x2028) + esc(0x2029) + BS + 'u{E0000}-' + BS + 'u{E007F}]', 'u')

type TextMode = 'single' | 'multi' | 'lines'

/**
 * The T1 pipeline. `single`: one line, whitespace collapsed. `multi`: LF kept.
 * `lines`: like multi but the outer newlines are kept so line numbers stay true (links).
 * Callers must have bounded the length of `raw` first when it comes from the network.
 */
function normalizeText(raw: string, mode: TextMode): string {
  let s = raw.replace(/\r\n?/g, '\n')
  s = s.replace(LONE_SURROGATE, String.fromCharCode(0xfffd))
  s = s.replace(STRIP_FORMAT, '')
  if (mode === 'single') {
    s = s.replace(CONTROLS_SINGLE, ' ')
    return s.replace(/\s+/g, ' ').trim()
  }
  s = s.replace(CONTROLS_MULTI, ' ')
  return mode === 'multi' ? s.trim() : s
}

/**
 * Single-line sanitiser, also used by the server for the email subject.
 * Strips CR/LF, C0/C1/DEL, U+2028/2029 and Cf (except U+200C-F), collapses whitespace.
 */
export function sanitizeSingleLine(raw: string): string {
  return normalizeText(raw, 'single')
}

/** Multi-line sanitiser (LF kept), used by the server when composing the email. */
export function sanitizeMultiLine(raw: string): string {
  return normalizeText(raw, 'multi')
}

/** Code points of an already-normalised string (lone surrogates are already replaced). */
function cpLength(s: string): number {
  let n = s.length
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) n--
  }
  return n
}

/** Description counter. Same pipeline as the server (CRLF to LF, strip, trim, code points). */
export function countCodePoints(text: string): number {
  return cpLength(normalizeText(text, 'multi'))
}

// ---------------------------------------------------------------------------
// Field builders
// ---------------------------------------------------------------------------

const RAW_FACTOR = 4

function failed(fail: Fail): { ok: false; fail: Fail } {
  return { ok: false, fail }
}

function textField(opts: { max: number; required: boolean }): FieldDef<string> {
  return {
    parse(raw, gate) {
      if (raw === undefined) {
        return opts.required ? failed({ code: 'required' }) : { ok: true, value: '' }
      }
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (gate && raw.length > opts.max * RAW_FACTOR) return failed({ code: 'too_long' })
      const v = normalizeText(raw, 'single')
      if (v === '') return opts.required ? failed({ code: 'required' }) : { ok: true, value: '' }
      const n = cpLength(v)
      if (n > opts.max) return failed({ code: 'too_long', count: n - opts.max })
      return { ok: true, value: v }
    },
  }
}

const PHONE_STRIP = /[ \-.()]/g
const PHONE_GRAMMAR = /^\+?[0-9]{7,15}(?:(?:x|ext)[0-9]{1,6})?$/i

function phoneField(): FieldDef<string> {
  const max = LIMITS.phone
  return {
    parse(raw, gate) {
      if (raw === undefined) return { ok: true, value: '' }
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (gate && raw.length > max * RAW_FACTOR) return failed({ code: 'too_long' })
      const v = normalizeText(raw, 'single')
      if (v === '') return { ok: true, value: '' }
      const n = cpLength(v)
      if (n > max) return failed({ code: 'too_long', count: n - max })
      // The length is bounded (<= 30 code points) before the grammar regex runs.
      if (!PHONE_GRAMMAR.test(v.replace(PHONE_STRIP, ''))) return failed({ code: 'invalid' })
      return { ok: true, value: v }
    },
  }
}

// --- Email (T1, T4) --------------------------------------------------------

// Apostrophe and % stay allowed (o'brien@ is a real address). Backtick, { and | are rejected, and so
// is the sequence "=?" (MIME encoded-word start) anywhere in the local part (SECURITY-REVIEW N1).
const EMAIL_LOCAL_ATOM = /^[A-Za-z0-9!#$%&'*+/=?^_}~-]+$/
const LABEL_CHARS = /^[A-Za-z0-9-]+$/
const TLD_ALPHA = /^[A-Za-z]{2,}$/

/** True for a valid ASCII addr-spec (the grammar of `reply_to` and MAIL_TO). Length is checked first. */
export function isValidAsciiEmail(value: string): boolean {
  if (value.length > LIMITS.email || value.length < 6) return false
  const at = value.indexOf('@')
  if (at < 1 || at !== value.lastIndexOf('@')) return false
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (local.length > 64 || domain.length > 253) return false
  if (local.includes('=?')) return false
  for (const atom of local.split('.')) {
    if (atom === '' || !EMAIL_LOCAL_ATOM.test(atom)) return false
  }
  const labels = domain.split('.')
  if (labels.length < 2) return false
  for (const label of labels) {
    if (label.length < 1 || label.length > 63) return false
    if (!LABEL_CHARS.test(label)) return false
    if (label.startsWith('-') || label.endsWith('-')) return false
  }
  const tld = labels[labels.length - 1] as string
  if (TLD_ALPHA.test(tld)) return true
  return tld.length > 4 && tld.slice(0, 4).toLowerCase() === 'xn--'
}

function emailField(): FieldDef<string> {
  const max = LIMITS.email
  return {
    parse(raw, gate) {
      if (raw === undefined) return failed({ code: 'required' })
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (gate && raw.length > max * RAW_FACTOR) return failed({ code: 'too_long' })
      // Validated on the raw value after trimming surrounding whitespace only.
      // Anything odd inside the address makes it invalid: it is never silently stripped.
      const v = raw.trim()
      if (v === '') return failed({ code: 'required' })
      if (v.length > max) return failed({ code: 'too_long', count: v.length - max })
      if (ANY_CONTROL_OR_FORMAT.test(v)) return failed({ code: 'invalid' })
      if (!isValidAsciiEmail(v)) return failed({ code: 'invalid' })
      const at = v.indexOf('@')
      // Lowercase the domain, preserve the local part's case.
      return { ok: true, value: v.slice(0, at) + '@' + v.slice(at + 1).toLowerCase() }
    },
  }
}

// --- Enums -----------------------------------------------------------------

function enumField<const T extends readonly string[]>(
  allowed: T,
  opts: { required: boolean },
): FieldDef<T[number] | ''> {
  return {
    parse(raw) {
      if (raw === undefined || raw === '') {
        return opts.required ? failed({ code: 'required' }) : { ok: true, value: '' }
      }
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (raw.length > 64 || !(allowed as readonly string[]).includes(raw)) return failed({ code: 'not_allowed' })
      return { ok: true, value: raw as T[number] }
    },
  }
}

function servicesField(): FieldDef<Service[]> {
  return {
    parse(raw) {
      if (raw === undefined) return failed({ code: 'required' })
      if (!Array.isArray(raw)) return failed({ code: 'invalid' })
      // Raw size gate before touching any element.
      if (raw.length > LIMITS.servicesRawMax) return failed({ code: 'invalid' })
      if (raw.length === 0) return failed({ code: 'required' })
      const seen = new Set<string>()
      for (const item of raw as unknown[]) {
        if (typeof item !== 'string') return failed({ code: 'invalid' })
        if (item.length > 32 || !(SERVICES as readonly string[]).includes(item)) {
          return failed({ code: 'not_allowed' })
        }
        seen.add(item)
      }
      // De-duplicated, canonical order.
      return { ok: true, value: SERVICES.filter((s) => seen.has(s)) }
    },
  }
}

// --- Description (T3a) -------------------------------------------------------

// A scheme-and-optional-www, or a bare www.  "https://www." counts once.
const URL_LIKE = /(?:https?:\/\/(?:www\.)?|www\.)/gi

function descriptionField(): FieldDef<string> {
  const { min, max, maxUrls } = LIMITS.description
  return {
    parse(raw, gate) {
      if (raw === undefined) return failed({ code: 'required' })
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (gate && raw.length > max * RAW_FACTOR) return failed({ code: 'too_long' })
      const v = normalizeText(raw, 'multi')
      if (v === '') return failed({ code: 'required' })
      const n = cpLength(v)
      if (n < min) return failed({ code: 'too_short', count: min - n })
      if (n > max) return failed({ code: 'too_long', count: n - max })
      // Length is bounded (<= 2000 code points) before this linear scan.
      const urls = v.match(URL_LIKE)
      if (urls !== null && urls.length > maxUrls) {
        return failed({ code: 'too_many', count: urls.length - maxUrls })
      }
      return { ok: true, value: v }
    },
  }
}

// --- Links -------------------------------------------------------------------

const SCHEME_PREFIX = /^([A-Za-z][A-Za-z0-9+.-]*):(?!\d+(?:[/?#]|$))/
const TLD_OK = /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/
const HREF_MAX = 2048

type LinkResult = { ok: true; href: string } | { ok: false; code: ErrorCode }

function parseLink(line: string): LinkResult {
  let candidate = line
  const m = SCHEME_PREFIX.exec(line)
  if (m === null) {
    candidate = 'https://' + line
  } else {
    const scheme = (m[1] as string).toLowerCase()
    if (scheme !== 'http' && scheme !== 'https') return { ok: false, code: 'bad_scheme' }
  }
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, code: 'invalid' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, code: 'bad_scheme' }
  if (url.username !== '' || url.password !== '') return { ok: false, code: 'not_allowed' }
  const host = url.hostname
  const labels = host.split('.')
  if (labels.length < 2) return { ok: false, code: 'invalid' }
  for (const label of labels) {
    if (label === '') return { ok: false, code: 'invalid' }
  }
  if (!TLD_OK.test(labels[labels.length - 1] as string)) return { ok: false, code: 'invalid' }
  if (url.href.length > HREF_MAX) return { ok: false, code: 'too_long' }
  return { ok: true, href: url.href }
}

function linksField(): FieldDef<string[]> {
  const { maxLines, maxLineLength } = LIMITS.links
  const rawMax = (maxLines * maxLineLength + maxLines) * RAW_FACTOR
  return {
    parse(raw, gate) {
      if (raw === undefined) return { ok: true, value: [] }
      if (typeof raw !== 'string') return failed({ code: 'invalid' })
      if (gate && raw.length > rawMax) return failed({ code: 'too_long' })
      const text = normalizeText(raw, 'lines')
      const lines = text.split('\n')
      const entries: { n: number; text: string }[] = []
      lines.forEach((l, i) => {
        const t = l.trim()
        if (t !== '') entries.push({ n: i + 1, text: t })
      })
      if (entries.length > maxLines) return failed({ code: 'too_many', count: entries.length - maxLines })
      // All length checks first, then the URL parsing.
      for (const e of entries) {
        const len = cpLength(e.text)
        if (len > maxLineLength) return failed({ code: 'too_long', line: e.n, count: len - maxLineLength })
      }
      const out: string[] = []
      for (const e of entries) {
        const r = parseLink(e.text)
        if (!r.ok) return failed({ code: r.code, line: e.n })
        out.push(r.href)
      }
      return { ok: true, value: out }
    },
  }
}

// --- Consent -----------------------------------------------------------------

function consentField(): FieldDef<true> {
  return {
    parse(raw) {
      if (raw === true) return { ok: true, value: true }
      if (raw === undefined || raw === false) return failed({ code: 'required' })
      return failed({ code: 'invalid' })
    },
  }
}

// ---------------------------------------------------------------------------
// The field table. Order = tab order = error order.
// ---------------------------------------------------------------------------

const FIELDS = {
  name: textField({ max: LIMITS.name, required: true }),
  email: emailField(),
  phone: phoneField(),
  business_name: textField({ max: LIMITS.business_name, required: true }),
  services: servicesField(),
  description: descriptionField(),
  links: linksField(),
  timeline: enumField(TIMELINES, { required: false }),
  referral_source: textField({ max: LIMITS.referral_source, required: false }),
  consent: consentField(),
}

export type FieldName = keyof typeof FIELDS

/** Normalized, validated, safe-to-use values (derived from the table). */
export type ServiceRequest = {
  [K in FieldName]: (typeof FIELDS)[K] extends FieldDef<infer T> ? T : never
}

/** What the browser sends: the raw values as typed, plus honeypot and token. */
export interface WireRequest {
  name: string
  email: string
  phone: string
  business_name: string
  services: string[]
  description: string
  links: string
  timeline: string
  referral_source: string
  consent: boolean
  homepage_url: string
  turnstile_token: string
}

const FIELD_NAMES = Object.keys(FIELDS) as FieldName[]

/** Allowlist of accepted JSON keys: the field keys plus the honeypot and the token. */
export const WIRE_KEYS: readonly string[] = [...FIELD_NAMES, HONEYPOT_FIELD, TURNSTILE_TOKEN_FIELD]
const WIRE_KEY_SET: ReadonlySet<string> = new Set(WIRE_KEYS)

// ---------------------------------------------------------------------------
// Validation entry points
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true; value: ServiceRequest }
  | { ok: false; errors: FieldError[] }

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function readOwn(input: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(input, key) ? input[key] : undefined
}

/** Unknown own key (including __proto__, budget, to, bcc) or a non-string honeypot. */
function hasBadShape(input: Record<string, unknown>): boolean {
  for (const key of Object.keys(input)) {
    if (!WIRE_KEY_SET.has(key)) return true
  }
  const hp = readOwn(input, HONEYPOT_FIELD)
  return hp !== undefined && typeof hp !== 'string'
}

export interface WireShape {
  ok: true
  /** Raw honeypot value (a string, possibly empty). */
  honeypot: string
  /** Raw token value. Not typed on purpose: the Turnstile step rejects a non-string with 403. */
  token: unknown
}

/**
 * Server step 6. Plain object, only allowlisted keys, honeypot present and a string.
 * The token may be absent or any type here: a missing or bad token is a 403 at the Turnstile
 * step, not a 400 (THREAT-MODEL: "Missing or forged token gives 403").
 */
export function checkWireShape(input: unknown): WireShape | { ok: false } {
  if (!isPlainObject(input) || hasBadShape(input)) return { ok: false }
  const hp = readOwn(input, HONEYPOT_FIELD)
  if (typeof hp !== 'string') return { ok: false }
  const services = readOwn(input, 'services')
  if (Array.isArray(services) && services.length > LIMITS.servicesRawMax) return { ok: false }
  return { ok: true, honeypot: hp, token: readOwn(input, TURNSTILE_TOKEN_FIELD) }
}

export interface ValidateOptions {
  /**
   * Client only. Skips the cheap raw-size bound so an oversized paste still reports an exact
   * `count`. The server never sets this.
   */
  exact?: boolean
}

/**
 * Strict validator and normaliser. The server entry point; the client uses it for the submit
 * check. A `_form`/`invalid` error means a malformed object (server responds 400, not 422).
 */
export function validateServiceRequest(input: unknown, options?: ValidateOptions): ValidationResult {
  if (!isPlainObject(input) || hasBadShape(input)) {
    return { ok: false, errors: [{ field: '_form', code: 'invalid' }] }
  }
  const gate = options?.exact !== true
  const errors: FieldError[] = []
  const out: Record<string, unknown> = {}
  for (const name of FIELD_NAMES) {
    const r = (FIELDS[name] as FieldDef<unknown>).parse(readOwn(input, name), gate)
    if (r.ok) {
      out[name] = r.value
    } else {
      const err: FieldError = { field: name, code: r.fail.code }
      if (r.fail.line !== undefined) err.line = r.fail.line
      if (r.fail.count !== undefined) err.count = r.fail.count
      errors.push(err)
    }
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: out as ServiceRequest }
}

/** Client blur/live validation for one field. Exact counts (no raw-size gate). */
export function validateField(field: FieldName, raw: unknown): FieldError | null {
  const r = (FIELDS[field] as FieldDef<unknown>).parse(raw, false)
  if (r.ok) return null
  const err: FieldError = { field, code: r.fail.code }
  if (r.fail.line !== undefined) err.line = r.fail.line
  if (r.fail.count !== undefined) err.count = r.fail.count
  return err
}

/**
 * Builds the request body from known keys only. Use it so the browser can never send a key the
 * server would reject as unknown. `raw` values are sent as typed; the server normalises.
 */
export function buildWireRequest(
  raw: {
    name: string
    email: string
    phone: string
    business_name: string
    services: readonly string[]
    description: string
    links: string
    timeline: string
    referral_source: string
    consent: boolean
  },
  extras: { homepage_url: string; turnstile_token: string },
): WireRequest {
  return {
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    business_name: raw.business_name,
    services: [...raw.services],
    description: raw.description,
    links: raw.links,
    timeline: raw.timeline,
    referral_source: raw.referral_source,
    consent: raw.consent,
    homepage_url: extras.homepage_url,
    turnstile_token: extras.turnstile_token,
  }
}

// ---------------------------------------------------------------------------
// Idempotency key format (client generates, server validates)
// ---------------------------------------------------------------------------

const UUID_V4 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && value.length === 36 && UUID_V4.test(value)
}

// ---------------------------------------------------------------------------
// Response contract (see BACKEND-NOTES.md for the status table)
// ---------------------------------------------------------------------------

export type ApiErrorSlug =
  | 'bad_request'
  | 'validation'
  | 'forbidden'
  | 'verification_failed'
  | 'rate_limited'
  | 'too_large'
  | 'unsupported'
  | 'method'
  | 'unavailable'
  | 'server'

export interface ApiFieldError {
  field: FieldName | '_form'
  code: ErrorCode
}

export type ApiSuccess = { ok: true; id: string }
export type ApiFailure = { ok: false; error: ApiErrorSlug; errors?: ApiFieldError[] }
export type ApiResponse = ApiSuccess | ApiFailure
