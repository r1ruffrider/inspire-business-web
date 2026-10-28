import { DRAFT_STORAGE_KEY, SERVICES, TIMELINES, type Service } from "@shared/serviceRequest"

// Session draft (sessionStorage, this tab only). It NEVER holds the consent box,
// the honeypot, the Turnstile token or the idempotency key. Every storage access
// is wrapped: private windows and blocked storage must not break the form.

export interface Draft {
  name: string
  email: string
  phone: string
  business_name: string
  services: Service[]
  description: string
  links: string
  timeline: string
  referral_source: string
}

export const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  business_name: "",
  services: [],
  description: "",
  links: "",
  timeline: "",
  referral_source: "",
}

const TEXT_CAP = 20000 // never persist a pathological paste

const str = (v: unknown) => (typeof v === "string" ? v.slice(0, TEXT_CAP) : "")

export function loadDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return EMPTY_DRAFT
    const v: unknown = JSON.parse(raw)
    if (typeof v !== "object" || v === null) return EMPTY_DRAFT
    const o = v as Record<string, unknown>
    return {
      name: str(o.name),
      email: str(o.email),
      phone: str(o.phone),
      business_name: str(o.business_name),
      services: Array.isArray(o.services)
        ? SERVICES.filter((s) => (o.services as unknown[]).includes(s))
        : [],
      description: str(o.description),
      links: str(o.links),
      timeline: (TIMELINES as readonly string[]).includes(str(o.timeline)) ? str(o.timeline) : "",
      referral_source: str(o.referral_source),
    }
  } catch {
    return EMPTY_DRAFT
  }
}

export function saveDraft(d: Draft): void {
  try {
    const empty = JSON.stringify(d) === JSON.stringify(EMPTY_DRAFT)
    if (empty) window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    else
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ ...d, description: d.description.slice(0, TEXT_CAP), links: d.links.slice(0, TEXT_CAP) }),
      )
  } catch {
    /* storage unavailable: the form still works */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
