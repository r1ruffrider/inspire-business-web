/**
 * Allowlisted logging (ARCHITECTURE 4.9, THREAT-MODEL T14).
 *
 * Only the event names and the field shapes below can ever be written. Free text never
 * reaches a log line: not an error message, not a vendor body, not a submitted value, not an
 * IP, not an Origin. Variable names, Cloudflare error codes and error class names are filtered
 * through strict patterns before they are printed.
 */

export type LogEvent =
  | 'config_missing'
  | 'config_invalid'
  | 'preview_real_inbox_refused'
  | 'honeypot'
  | 'rate_limited'
  | 'ip_header_missing'
  | 'turnstile_failed'
  | 'turnstile_unreachable'
  | 'turnstile_mismatch'
  | 'resend_error'
  | 'resend_timeout'
  | 'sent'
  | 'unhandled_error'

export interface LogFields {
  /** Environment variable names (config events). */
  names?: readonly string[]
  /** Cloudflare error codes (turnstile_failed). */
  codes?: readonly string[]
  httpStatus?: number
  errorName?: string
}

export type LogSink = (line: string) => void
export type Logger = (event: LogEvent, fields?: LogFields) => void

const NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/
const CODE_RE = /^[a-z0-9][a-z0-9-]{0,47}$/
const ERROR_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

/** err.name only, never err.message or err.stack. */
export function errorNameOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name: unknown }).name
    if (typeof name === 'string' && ERROR_NAME_RE.test(name)) return name
  }
  return 'UnknownError'
}

export function createLogger(sink: LogSink): Logger {
  return (event, fields) => {
    const out: Record<string, unknown> = { event }
    if (fields !== undefined) {
      if (fields.names !== undefined) {
        out.names = fields.names.filter((n) => NAME_RE.test(n)).slice(0, 16)
      }
      if (fields.codes !== undefined) {
        out.codes = fields.codes.filter((c) => CODE_RE.test(c)).slice(0, 8)
      }
      if (fields.httpStatus !== undefined && Number.isInteger(fields.httpStatus)) {
        out.httpStatus = fields.httpStatus
      }
      if (fields.errorName !== undefined && ERROR_NAME_RE.test(fields.errorName)) {
        out.errorName = fields.errorName
      }
    }
    sink(JSON.stringify(out))
  }
}

/** Default sink: one JSON line on stdout. */
export const consoleSink: LogSink = (line) => {
  console.log(line)
}
