/**
 * Mail transports (ARCHITECTURE 6.1). Plain fetch to Resend's JSON API, no SDK.
 *
 * The Resend request body is a FIXED-KEY object literal containing exactly
 * from, to, reply_to, subject, text, html. No cc, bcc, headers, tags, attachments or
 * scheduled_at, and none of these is built from a loop, a spread or a variable key.
 */

export interface MailMessage {
  /** `Display Name <addr>` from MAIL_FROM (constant, never touched by user data). */
  from: string
  /** Exactly one recipient (MAIL_TO). */
  to: string
  /** The submitter's bare, validated address. Sent only as `reply_to`. */
  replyTo: string
  subject: string
  text: string
  html: string
  /** `sr-<lowercase uuid>`, delegated to Resend as the Idempotency-Key header. */
  idempotencyKey: string
}

export interface MailTransport {
  send(msg: MailMessage, signal: AbortSignal): Promise<{ id: string }>
}

export class MailError extends Error {
  status: number | null
  constructor(status: number | null) {
    super('mail_error')
    this.name = 'MailError'
    this.status = status
  }
}

export const RESEND_URL = 'https://api.resend.com/emails'

export function resendTransport(apiKey: string, fetchFn: typeof fetch): MailTransport {
  return {
    async send(msg, signal) {
      const res = await fetchFn(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': msg.idempotencyKey,
        },
        // VERIFY (Renata/Natalia): `reply_to` is the REST field name (the Node SDK calls it replyTo).
        body: JSON.stringify({
          from: msg.from,
          to: [msg.to],
          reply_to: msg.replyTo,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
        signal,
      })
      // Never read or log the vendor body on failure: it can echo addresses.
      if (!res.ok) throw new MailError(res.status)
      let data: unknown
      try {
        data = await res.json()
      } catch {
        throw new MailError(res.status)
      }
      const id = typeof data === 'object' && data !== null ? (data as { id?: unknown }).id : undefined
      if (typeof id !== 'string' || id === '') throw new MailError(res.status)
      return { id }
    },
  }
}

/**
 * Local-only transport: prints the composed message to the dev console and returns a fake id.
 * readConfig refuses MAIL_TRANSPORT=log whenever VERCEL is set, so this cannot run on a deployment.
 */
export function logTransport(write: (text: string) => void): MailTransport {
  return {
    async send(msg) {
      write(
        [
          '--- [dev mail transport: not sent] ---',
          'From:     ' + msg.from,
          'To:       ' + msg.to,
          'Reply-To: ' + msg.replyTo,
          'Subject:  ' + msg.subject,
          'Idempotency-Key: ' + msg.idempotencyKey,
          '',
          msg.text,
          '--- end ---',
        ].join('\n'),
      )
      return { id: 'dev-log-' + msg.idempotencyKey.slice(3, 11) }
    },
  }
}
