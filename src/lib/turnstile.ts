import { TURNSTILE_ACTION } from "@shared/serviceRequest"

// Cloudflare's documented always-pass TEST site key. Used ONLY by the dev server
// when VITE_TURNSTILE_SITE_KEY is unset. Never compiled into a production path:
// import.meta.env.DEV is the literal false there.
const DEV_TEST_SITE_KEY = "1x00000000000000000000AA"

/** Public by design (VITE_ prefix). Empty string = not configured. */
export const SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
  (import.meta.env.DEV ? DEV_TEST_SITE_KEY : "")

/** A production build with no key is NOT a working form: fail closed. */
export const TURNSTILE_CONFIGURED: boolean = SITE_KEY !== ""

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let scriptPromise: Promise<void> | null = null

/** Loads Cloudflare's script once, only when asked (first interaction with the form). */
export function ensureTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => (window.turnstile ? resolve() : reject(new Error("turnstile_missing")))
    s.onerror = () => {
      scriptPromise = null // allow a retry after a blocked or failed load
      reject(new Error("turnstile_blocked"))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export interface TurnstileHandle {
  /** The current token, or waits up to `ms` for the widget to produce one. */
  getToken(ms?: number): Promise<string>
  /** Discard the (spent) token and ask for a fresh one. */
  reset(): void
  remove(): void
}

/**
 * Renders the widget into `container`. `appearance: "interaction-only"` keeps it
 * invisible unless Cloudflare needs the visitor. No user data is ever passed in
 * the options (no cData). `action` must equal the server's expected action.
 */
export function renderTurnstile(
  container: HTMLElement,
  onFailure: (reason: "error" | "timeout") => void,
): TurnstileHandle {
  let token: string | null = null
  let failed = false
  const waiters = new Set<(t: string | Error) => void>()

  const flush = (v: string | Error) => {
    waiters.forEach((w) => w(v))
    waiters.clear()
  }

  const id = window.turnstile!.render(container, {
    sitekey: SITE_KEY,
    action: TURNSTILE_ACTION,
    appearance: "interaction-only",
    theme: "dark",
    callback: (t) => {
      token = t
      failed = false
      flush(t)
    },
    "error-callback": () => {
      token = null
      failed = true
      flush(new Error("turnstile_error"))
      onFailure("error")
      return true
    },
    "expired-callback": () => {
      // A token lives about 5 minutes and is single use: ask for a new one.
      token = null
      window.turnstile?.reset(id)
    },
    "timeout-callback": () => {
      token = null
      onFailure("timeout")
    },
  })

  return {
    getToken(ms = 10000) {
      if (token) return Promise.resolve(token)
      if (failed) {
        // try again once before giving up
        failed = false
        window.turnstile?.reset(id)
      }
      return new Promise<string>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          waiters.delete(waiter)
          reject(new Error("turnstile_timeout"))
        }, ms)
        const waiter = (v: string | Error) => {
          window.clearTimeout(timer)
          if (v instanceof Error) reject(v)
          else resolve(v)
        }
        waiters.add(waiter)
      })
    },
    reset() {
      token = null
      window.turnstile?.reset(id)
    },
    remove() {
      token = null
      flush(new Error("turnstile_removed"))
      window.turnstile?.remove(id)
    },
  }
}
