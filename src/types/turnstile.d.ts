// Minimal typing for Cloudflare Turnstile's explicit-render API (no @types package).
interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  appearance?: "always" | "execute" | "interaction-only"
  theme?: "light" | "dark" | "auto"
  callback?: (token: string) => void
  "error-callback"?: (errorCode?: string) => boolean | void
  "expired-callback"?: () => void
  "timeout-callback"?: () => void
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string
  reset(widgetId?: string): void
  remove(widgetId?: string): void
}

interface Window {
  turnstile?: TurnstileApi
}
