// Reduced-motion helpers. No state: callers read the query when they need it.
const QUERY = "(prefers-reduced-motion: reduce)"

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches
}

/** Subscribe to changes of the reduced-motion preference. Returns an unsubscribe. */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  const mq = window.matchMedia(QUERY)
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mq.addEventListener("change", handler)
  return () => mq.removeEventListener("change", handler)
}
