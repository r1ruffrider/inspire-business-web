/**
 * Email composition (ARCHITECTURE 6, THREAT-MODEL T1, T2, T3, T4, T5).
 *
 *  - Text part and HTML part. First line of both: the fixed untrusted-content notice.
 *  - Every user value is escaped at ONE sink (escapeHtml), reached only through cell()/quoteCell().
 *  - Text part: every line of user-supplied text carries the fixed marker "> ", so a description
 *    containing "CONSENT" or "Reference:" cannot forge a section.
 *  - Name and Email are separate plain lines. Links are printed as text, never as <a>.
 *  - No IP, user agent, Origin or referrer anywhere (the function is never given them).
 *  - No user value is ever placed in a tag name, attribute, URL or style.
 */
import {
  sanitizeMultiLine,
  sanitizeSingleLine,
  SERVICES,
  PRIVACY_NOTE_VERSION,
} from '../../shared/serviceRequest.ts'
import type { ServiceRequest } from '../../shared/serviceRequest.ts'
import type { MailMessage } from './mail.ts'

/** Bumped by whoever changes COPY.md section 4 (the privacy note). Date string. */
// Single source of truth lives in shared/serviceRequest.ts (the page reads it from there).
export { PRIVACY_NOTE_VERSION }

export const UNTRUSTED_NOTICE =
  'Untrusted content from a website visitor. Do not open links you did not expect.'

export const SUBJECT_BUSINESS_MAX = 60
export const SUBJECT_MAX = 150

/**
 * Timestamp precision printed in the email. Resend deduplicates on Idempotency-Key only when the
 * payload is identical, and the email contains the acceptance time. DECIDED (orchestrator, F1):
 * 'minute', so an immediate retry with the same key produces an identical payload. Residual: a retry
 * after the minute boundary gets Resend's 409 (mapped to 502) although the first send succeeded.
 */
export const TIMESTAMP_PRECISION: 'second' | 'minute' = 'minute'

const ELLIPSIS = String.fromCharCode(0x2026)
const NOT_PROVIDED = 'Not provided'
const MARKER = '> '

const SERVICE_LABELS: Record<(typeof SERVICES)[number], string> = {
  website: 'Website',
  logo: 'Logo',
  branding: 'Business branding',
}
const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  '1-3-months': 'Within 1 to 3 months',
  flexible: 'Flexible',
  unsure: 'Not sure yet',
}

// ---------------------------------------------------------------------------
// Escaping: the single sink
// ---------------------------------------------------------------------------

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] as string)
}

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

function truncateCodePoints(text: string, max: number): string {
  const points = Array.from(text)
  if (points.length <= max) return text
  return points.slice(0, max - 1).join('') + ELLIPSIS
}

/** Strip CR/LF, controls, DEL, U+2028/9 and Cf (except ZWNJ/ZWJ/LRM/RLM), collapse whitespace, cap. */
export function sanitizeForSubject(text: string, max: number = SUBJECT_BUSINESS_MAX): string {
  // Bound the length before any regex runs.
  const bounded = text.length > 480 ? text.slice(0, 480) : text
  return truncateCodePoints(sanitizeSingleLine(bounded), max)
}

export function buildSubject(value: ServiceRequest, production: boolean): string {
  const services = value.services.map((s) => SERVICE_LABELS[s]).join(', ')
  const business = sanitizeForSubject(value.business_name)
  const subject = `New service request: ${services} - ${business}`
  const prefixed = production ? subject : '[TEST] ' + subject
  // The prefix is part of the cap so the whole subject stays within SUBJECT_MAX.
  return truncateCodePoints(prefixed, SUBJECT_MAX)
}

// ---------------------------------------------------------------------------
// Timestamps (6.3)
// ---------------------------------------------------------------------------

function formatStamp(date: Date, timeZone: string, precision: 'second' | 'minute'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  const day = `${get('year')}-${get('month')}-${get('day')}`
  const clock = precision === 'second' ? `${get('hour')}:${get('minute')}:${get('second')}` : `${get('hour')}:${get('minute')}`
  return `${day} ${clock}`
}

export function formatUtc(date: Date, precision: 'second' | 'minute' = TIMESTAMP_PRECISION): string {
  return formatStamp(date, 'UTC', precision)
}

/** Qatar has no DST. If Intl lacks the zone, the deterministic fallback is UTC plus 3 hours. */
export function formatQatar(date: Date, precision: 'second' | 'minute' = TIMESTAMP_PRECISION): string {
  try {
    return formatStamp(date, 'Asia/Qatar', precision)
  } catch {
    return formatStamp(new Date(date.getTime() + 3 * 60 * 60 * 1000), 'UTC', precision)
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type Row =
  | { kind: 'heading'; text: string }
  | { kind: 'plain'; label: string; value: string } // value is server-controlled text
  | { kind: 'line'; text: string } // server-controlled text without a label
  | { kind: 'note'; text: string } // closing server-controlled sentence
  | { kind: 'user'; label: string; value: string | null } // single-line user value; null = not provided
  | { kind: 'block'; lines: string[] } // multi-line user text under a heading

const LABEL_WIDTH = 22

function userLines(text: string): string[] {
  return sanitizeMultiLine(text).split('\n')
}

function renderText(rows: Row[]): string {
  const out: string[] = [UNTRUSTED_NOTICE, '']
  for (const row of rows) {
    if (row.kind === 'heading') {
      if (out[out.length - 1] !== '') out.push('')
      out.push(row.text)
    } else if (row.kind === 'plain') {
      out.push('  ' + (row.label + ':').padEnd(LABEL_WIDTH) + row.value)
    } else if (row.kind === 'line') {
      out.push('  ' + row.text)
    } else if (row.kind === 'note') {
      out.push('', row.text)
    } else if (row.kind === 'user') {
      const label = (row.label + ':').padEnd(LABEL_WIDTH)
      out.push('  ' + label + (row.value === null ? NOT_PROVIDED : MARKER + sanitizeSingleLine(row.value)))
    } else {
      for (const l of row.lines) out.push(MARKER + l)
    }
  }
  return out.join('\n') + '\n'
}

// HTML. escapeHtml is reached only through cell() and quoteCell(); no other code inserts text.
const CELL = 'padding:6px 10px;border-bottom:1px solid #e3e3e8;vertical-align:top;font-size:14px;line-height:1.5;'
const QUOTE = 'border-left:3px solid #9a9aa8;padding:6px 10px;background:#f7f7fa;word-break:break-word;overflow-wrap:anywhere;'

function cell(text: string): string {
  return escapeHtml(text)
}

function quoteCell(lines: readonly string[]): string {
  return lines.map((l) => escapeHtml(l)).join('<br>')
}

function renderHtml(rows: Row[]): string {
  const body: string[] = []
  body.push(
    `<tr><td colspan="2" style="background:#fff4d6;border:1px solid #d9a400;padding:10px;font-size:14px;font-weight:bold;">${cell(UNTRUSTED_NOTICE)}</td></tr>`,
  )
  for (const row of rows) {
    if (row.kind === 'heading') {
      body.push(
        `<tr><td colspan="2" style="padding:16px 10px 4px 10px;font-size:12px;letter-spacing:1px;font-weight:bold;color:#444;">${cell(row.text)}</td></tr>`,
      )
    } else if (row.kind === 'plain') {
      body.push(
        `<tr><td style="${CELL}color:#555;width:150px;">${cell(row.label)}</td><td dir="auto" style="${CELL}">${cell(row.value)}</td></tr>`,
      )
    } else if (row.kind === 'line') {
      body.push(`<tr><td colspan="2" style="${CELL}">${cell(row.text)}</td></tr>`)
    } else if (row.kind === 'note') {
      body.push(`<tr><td colspan="2" style="${CELL}color:#555;">${cell(row.text)}</td></tr>`)
    } else if (row.kind === 'user') {
      const inner =
        row.value === null
          ? cell(NOT_PROVIDED)
          : `<div dir="auto" style="${QUOTE}">${quoteCell([sanitizeSingleLine(row.value)])}</div>`
      body.push(
        `<tr><td style="${CELL}color:#555;width:150px;">${cell(row.label)}</td><td dir="auto" style="${CELL}">${inner}</td></tr>`,
      )
    } else {
      body.push(
        `<tr><td colspan="2" style="${CELL}"><div dir="auto" style="${QUOTE}">${quoteCell(row.lines)}</div></td></tr>`,
      )
    }
  }
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:16px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse;">' +
    body.join('') +
    '</table></body></html>'
  )
}

// ---------------------------------------------------------------------------
// composeEmail
// ---------------------------------------------------------------------------

export interface ComposeParams {
  value: ServiceRequest
  /** `SR-XXXXXXXX` */
  reference: string
  /** The single clock reading taken at acceptance. */
  now: Date
  from: string
  to: string
  /** `sr-<lowercase uuid>` */
  idempotencyKey: string
  production: boolean
}

export function composeEmail(p: ComposeParams): MailMessage {
  const v = p.value
  const utc = formatUtc(p.now)
  const qatar = formatQatar(p.now)

  const user = (label: string, text: string): Row => ({
    kind: 'user',
    label,
    value: sanitizeSingleLine(text) === '' ? null : text,
  })

  const linkLines = v.links.map((href, i) => `${i + 1}. ${sanitizeSingleLine(href)}`)

  const rows: Row[] = [
    { kind: 'heading', text: 'NEW SERVICE REQUEST' },
    { kind: 'plain', label: 'Reference', value: p.reference },
    { kind: 'heading', text: 'SUBMITTED' },
    { kind: 'plain', label: 'UTC', value: utc },
    { kind: 'plain', label: 'Qatar', value: `${qatar} (Asia/Qatar, UTC+03:00)` },
    { kind: 'heading', text: 'CONTACT' },
    user('Name', v.name),
    user('Email', v.email),
    user('Phone', v.phone),
    user('Business name', v.business_name),
    { kind: 'heading', text: 'REQUEST' },
    { kind: 'plain', label: 'Services', value: v.services.map((s) => SERVICE_LABELS[s]).join(', ') },
    { kind: 'plain', label: 'Timeline', value: v.timeline === '' ? NOT_PROVIDED : (TIMELINE_LABELS[v.timeline] ?? NOT_PROVIDED) },
    user('Heard about us via', v.referral_source),
    { kind: 'heading', text: 'PROJECT DESCRIPTION' },
    { kind: 'block', lines: userLines(v.description) },
    { kind: 'heading', text: 'LINKS' },
    linkLines.length === 0 ? { kind: 'line', text: NOT_PROVIDED } : { kind: 'block', lines: linkLines },
    { kind: 'heading', text: 'CONSENT' },
    { kind: 'line', text: `Agreed to the privacy note on ${utc} UTC` },
    { kind: 'plain', label: 'Privacy note version', value: PRIVACY_NOTE_VERSION },
    { kind: 'note', text: 'Reply to this email to answer the sender (Reply-To is their address).' },
  ]

  return {
    from: p.from,
    to: p.to,
    replyTo: v.email,
    subject: buildSubject(v, p.production),
    text: renderText(rows),
    html: renderHtml(rows),
    idempotencyKey: p.idempotencyKey,
  }
}
