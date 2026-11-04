import { PRIVACY_NOTE_VERSION } from "@shared/serviceRequest"

export const PRIVACY_NOTE_ID = "privacy-note"

/**
 * Privacy note body. Text: COPY.md section 4, kept word for word (legal copy is
 * an owner decision). Facts nobody has supplied yet are listed in OWNER-TODO.md
 * at the repo root and are never invented on the page.
 * Phase 2 can reuse <PrivacyNoteBody/> inside the form's consent disclosure.
 */
export function PrivacyNoteBody() {
  return (
    <div className="privacy__body">
      <p>
        <strong>This page.</strong> This page loads fonts from Google Fonts, so Google receives
        your IP address when the page loads.
      </p>
      <p>
        <strong>What the request form collects.</strong> What you type into the form: your name,
        email, phone (if you add one), business name, the services you choose, your project
        description, any links, timeline and how you heard about us. The email we receive also
        shows the time you sent it.
      </p>
      <p>
        <strong>Spam protection.</strong> This form uses Cloudflare Turnstile. The first time you
        click, tap or move keyboard focus into the form, your browser loads a Cloudflare script,
        and Cloudflare may process your IP address and browser signals. Our host, Vercel, sees IP
        addresses in its logs and in its Firewall counters. Our server keeps only a salted hash of
        your IP address, in memory, for about 10 minutes, or until the server restarts, to limit
        repeated sends.
      </p>
      <p>
        <strong>Why.</strong> To reply to your request and discuss your project, to block spam,
        and, if you tell us how you heard about us, to understand how people find us.
      </p>
      <p>
        <strong>Who handles it.</strong> This site is hosted on Vercel. Your message is sent by
        Resend, an email service, to our company inbox, hosted by Hostinger. The form has no
        database and takes no files. Resend keeps the content of your message for its own
        retention period. Our
        hosting and email providers may keep their own technical records.
      </p>
      <p>
        While you type, a draft of your answers is kept in this browser tab only. It never
        includes the consent box. It is cleared once your request is sent.
      </p>
      <p>
        <strong>Corrections and deletion.</strong> Email info@inspirebusinesstechnology.com to ask
        us to correct or delete your details.
      </p>
      <p>
        Inspire Business Group LLC.
      </p>
      <p className="privacy__version">Privacy note version: {PRIVACY_NOTE_VERSION}</p>
    </div>
  )
}

/** The note as a disclosure with a stable anchor (the footer link target). */
export default function PrivacyNote() {
  return (
    <details className="privacy" id={PRIVACY_NOTE_ID}>
      <summary>Privacy note</summary>
      <PrivacyNoteBody />
    </details>
  )
}
