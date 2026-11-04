// Native, instant in-page navigation. No smooth scrolling and no scroll-linked
// motion anywhere (brief v2, change 4): a jump lands at once, then focus moves
// to the target's heading so keyboard and screen-reader users start there.
// The sticky header's height is handled in CSS (html { scroll-padding-top }).

export interface ScrollOpts {
  /** Update the URL hash (shareable link). Default true. */
  updateHash?: boolean
}

/** True for a click that was produced by the keyboard (Enter or Space). */
export function isKeyboardClick(e: { detail: number }): boolean {
  return e.detail === 0
}

function focusTarget(selector: string, target: HTMLElement) {
  const el =
    selector === "#request-services"
      ? (document.getElementById("rs-heading") ?? target)
      : (target.querySelector<HTMLElement>("h1, h2") ?? target)
  if (!el.hasAttribute("tabindex") && !el.matches("a, button, input, select, textarea, summary")) {
    el.setAttribute("tabindex", "-1")
  }
  el.focus({ preventScroll: true })
}

export function scrollToSection(selector: string, opts: ScrollOpts = {}) {
  let target: HTMLElement | null = null
  try {
    target = document.querySelector<HTMLElement>(selector)
  } catch {
    return // not a valid selector (e.g. a hand-typed hash)
  }
  if (!target) return
  if (opts.updateHash !== false) {
    const url = selector === "#top" ? window.location.pathname + window.location.search : selector
    window.history.replaceState(null, "", url)
  }
  target.scrollIntoView({ block: "start", behavior: "instant" })
  requestAnimationFrame(() => focusTarget(selector, target))
}
