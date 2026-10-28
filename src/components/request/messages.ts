import { LIMITS, type FieldError } from "@shared/serviceRequest"

// Every string here comes from docs/pro-upgrade/COPY.md section 3 (and UX-SPEC
// section 4 where COPY says KEEP). The UI maps error CODES to these strings:
// raw server text is never shown.

export const EMAIL = "info@inspirebusinesstechnology.com"

/** (field, code) to the inline message. null = no message for that pair. */
export function fieldMessage(err: FieldError): string | null {
  const n = err.count
  const line = err.line
  switch (err.field) {
    case "name":
      if (err.code === "required") return "Enter your name."
      if (err.code === "too_long") return `Use ${LIMITS.name} characters or fewer for your name.`
      return null
    case "email":
      if (err.code === "required")
        return "Enter your email address so we can contact you about your request."
      if (err.code === "invalid") return "Enter a valid email address, like name@example.com."
      if (err.code === "too_long")
        return `That email address is too long. Use ${LIMITS.email} characters or fewer.`
      return null
    case "phone":
      if (err.code === "invalid" || err.code === "too_long")
        return "Enter a valid phone number, or leave this blank."
      return null
    case "business_name":
      if (err.code === "required") return "Enter your business name."
      if (err.code === "too_long")
        return `Use ${LIMITS.business_name} characters or fewer for your business name.`
      return null
    case "services":
      if (err.code === "required" || err.code === "not_allowed" || err.code === "invalid")
        return "Select at least one service."
      return null
    case "description":
      if (err.code === "required") return "Describe your project so we know what you need."
      if (err.code === "too_short" && n !== undefined)
        return `Add a little more detail: at least ${LIMITS.description.min} characters (you have ${LIMITS.description.min - n}).`
      if (err.code === "too_long" && n !== undefined)
        return `Shorten your description by ${n.toLocaleString("en-US")} characters. The limit is ${LIMITS.description.max.toLocaleString("en-US")}.`
      if (err.code === "too_many")
        return `Use ${LIMITS.description.maxUrls} links or fewer in the description. Put extra links in the links field.`
      return null
    case "links":
      if (err.code === "too_many" && n !== undefined)
        return `Add up to ${LIMITS.links.maxLines} links, one per line. Remove ${n}.`
      if (line === undefined) return null
      // "not_allowed" (credentials inside an address) has no string of its own in COPY:
      // it is shown as the not-a-web-address line message.
      if (err.code === "invalid" || err.code === "not_allowed")
        return `Line ${line} doesn’t look like a web address. Use something like example.com or https://example.com.`
      if (err.code === "bad_scheme")
        return `Line ${line}: only addresses starting with http or https can be used.`
      if (err.code === "too_long")
        return `Line ${line} is too long. Use ${LIMITS.links.maxLineLength} characters or fewer.`
      return null
    case "referral_source":
      if (err.code === "too_long") return `Use ${LIMITS.referral_source} characters or fewer.`
      return null
    case "consent":
      if (err.code === "required" || err.code === "invalid")
        return "Tick the box to agree to the privacy note before sending."
      return null
    default:
      return null
  }
}

export function summaryHeading(n: number): string {
  return n === 1 ? "1 thing needs your attention" : `${n} things need your attention`
}

export type BannerKind = "generic" | "rate" | "offline" | "unknown" | "verify" | "fields"

export interface BannerText {
  title: string
  body?: string
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

/**
 * Rate-limit wording from the TRUE remaining wait. Under 60 s: seconds. From 60 s:
 * minutes rounded UP, so the text never understates the wait.
 */
export function rateLimitText(remainingSeconds: number): BannerText {
  const s = Math.max(1, Math.ceil(remainingSeconds))
  const wait =
    s < 60
      ? `${s} ${plural(s, "second", "seconds")}`
      : `${Math.ceil(s / 60)} ${plural(Math.ceil(s / 60), "minute", "minutes")}`
  return {
    title: "Too many requests right now",
    body: `Please try again in ${wait}. You can also email ${EMAIL} instead. Your answers are still here.`,
  }
}

export function bannerText(kind: Exclude<BannerKind, "rate">): BannerText {
  switch (kind) {
    case "generic":
      return {
        title: "We couldn’t send your request",
        body: `Something went wrong. Your answers are still here, so you can try again. If it keeps happening, email ${EMAIL}.`,
      }
    case "offline":
      return {
        title: "You’re offline",
        body: "Check your connection, then try again. Your answers are still here.",
      }
    case "unknown":
      return {
        title: "We’re not sure your request went through",
        body: `We didn’t get a clear answer from the server. Try sending it again. If this keeps happening, email ${EMAIL}.`,
      }
    case "verify":
      return {
        title: "We couldn’t verify this request",
        body: "Reload the page and try again.",
      }
    case "fields":
      return { title: "Some details need fixing" }
  }
}

export const STATUS = {
  sending: "Sending your request…",
  cooldownEnded: "You can send your request now.",
  backOnline: "You’re back online. You can send your request now.",
} as const

export const OFFLINE_NOTE =
  "You’re offline. You can keep filling this in, but you’ll need a connection to send it."

/** "Thanks, {firstName}." with the first name cut at 30 characters; "Thanks." without one. */
export function thanksLine(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ""
  if (!first) return "Thanks."
  const chars = Array.from(first)
  const shown = chars.length > 30 ? chars.slice(0, 30).join("") + "…" : first
  return `Thanks, ${shown}.`
}

/** Characters-remaining announcements for the counter (COPY 5.6). */
export function counterAnnouncement(n: number): string | null {
  const max = LIMITS.description.max
  if (n > max) return `${(n - max).toLocaleString("en-US")} characters over the limit`
  if (n === max) return "Character limit reached"
  if (n >= 1800) return `${max - n} characters remaining`
  return null
}
