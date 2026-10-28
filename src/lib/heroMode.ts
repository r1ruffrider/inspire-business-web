import { prefersReducedMotion } from "@/lib/motion"

export type HeroMode = "scrub" | "static"

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Decides, once, whether the hero uses the scroll-scrubbed film or the static
 * alternative. Static = reduced motion, Save-Data, or a 2g/3g connection.
 * The Network Information API is Chromium-only; elsewhere the answer is
 * "scrub" and the windowed frame loader keeps the cost low.
 */
export function getHeroMode(): HeroMode {
  if (typeof window === "undefined") return "scrub"
  if (prefersReducedMotion()) return "static"
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (conn?.saveData) return "static"
  if (conn?.effectiveType && ["slow-2g", "2g", "3g"].includes(conn.effectiveType)) {
    return "static"
  }
  return "scrub"
}
