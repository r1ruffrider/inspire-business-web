import { DEFAULTS } from "./site"
import { worstCase } from "./worstCase"
import type { SiteContent } from "./types"

// Development-only: ?data=worst swaps in the break-ui dataset. In a production
// build import.meta.env.DEV is the literal false, so the worst case is dead
// code and is dropped from the bundle.
export const isWorstCase: boolean =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("data") === "worst"

export const content: SiteContent = import.meta.env.DEV && isWorstCase ? worstCase() : DEFAULTS
export { EMAIL, LEGAL_NAME, NAV_LINKS, navLinks } from "./site"
