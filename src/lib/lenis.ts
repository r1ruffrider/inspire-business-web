import Lenis from "lenis"
import { onReducedMotionChange, prefersReducedMotion } from "@/lib/motion"

let lenisInstance: Lenis | null = null
let rafId = 0
let syncHandler: (() => void) | null = null
let watching = false

function create(): Lenis {
  const lenis = new Lenis({ lerp: 0.08 })
  const raf = (time: number) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  }
  rafId = requestAnimationFrame(raf)

  // Dragging the native scrollbar bypasses Lenis's internal target tracking,
  // so it snaps back to a stale position. Re-sync when the browser (not
  // Lenis) drove the scroll. See darkroomengineering/lenis#168, #107.
  syncHandler = () => {
    if (!lenis.isScrolling) {
      lenis.scrollTo(window.scrollY, { immediate: true })
    }
  }
  window.addEventListener("scroll", syncHandler, { passive: true })
  return lenis
}

function destroy() {
  if (!lenisInstance) return
  cancelAnimationFrame(rafId)
  if (syncHandler) window.removeEventListener("scroll", syncHandler)
  syncHandler = null
  lenisInstance.destroy()
  lenisInstance = null
}

/** Smooth scrolling. Returns null (and creates nothing) under reduced motion. */
export function initLenis(): Lenis | null {
  if (!watching) {
    watching = true
    onReducedMotionChange((reduced) => {
      if (reduced) destroy()
      else if (!lenisInstance) lenisInstance = create()
    })
  }
  if (lenisInstance) return lenisInstance
  if (prefersReducedMotion()) return null
  lenisInstance = create()
  return lenisInstance
}

/** Menu scroll lock helpers (null-safe). Never uses overflow:hidden. */
export function stopLenis() {
  lenisInstance?.stop()
}
export function startLenis() {
  lenisInstance?.start()
}

export interface ScrollOpts {
  /** The action came from the keyboard: never animate. */
  keyboard?: boolean
  /** Update the URL hash (shareable link). Default true. */
  updateHash?: boolean
}

/** True for a click that was produced by the keyboard (Enter or Space). */
export function isKeyboardClick(e: { detail: number }): boolean {
  return e.detail === 0
}

function focusTarget(selector: string, target: HTMLElement) {
  // Land on the section's heading (the request section has a dedicated one); the hero and
  // anything without a heading take focus themselves.
  const el =
    selector === "#request-services"
      ? (document.getElementById("rs-heading") ?? target)
      : (target.querySelector<HTMLElement>("h2") ?? target)
  if (!el.hasAttribute("tabindex") && !el.matches("a, button, input, select, textarea, summary")) {
    el.setAttribute("tabindex", "-1")
  }
  el.focus({ preventScroll: true })
}

/**
 * Scrolls to a section. Far jumps (more than 2 viewports) and keyboard-driven
 * jumps are instant; short hops glide for at most 600 ms. With no Lenis
 * instance (reduced motion) it uses the native, instant scrollIntoView.
 * Afterwards focus moves to the target so keyboard and screen-reader users land
 * at its start.
 */
export function scrollToSection(selector: string, opts: ScrollOpts = {}) {
  let target: HTMLElement | null = null
  try {
    target = document.querySelector<HTMLElement>(selector)
  } catch {
    return // not a valid selector (e.g. a hand-typed hash)
  }
  if (!target) return
  const top = target.getBoundingClientRect().top
  const far = Math.abs(top) > window.innerHeight * 2
  const instant = far || !!opts.keyboard
  // Focus on the next frame, after any menu/inert change has been applied, in every path.
  const finish = () => requestAnimationFrame(() => focusTarget(selector, target))

  if (opts.updateHash !== false) {
    const url = selector === "#top" ? window.location.pathname + window.location.search : selector
    window.history.replaceState(null, "", url)
  }

  if (lenisInstance) {
    // Lenis clamps to its cached scroll limit; on a deep link React has just
    // replaced the pre-rendered shell, so refresh the measurement first.
    lenisInstance.resize()
    lenisInstance.scrollTo(target, {
      // no offset: Lenis already honours scroll-margin-top and the container's scroll-padding-top, like scrollIntoView
      offset: 0,
      immediate: instant,
      duration: 0.6,
      onComplete: finish,
    })
    if (instant) finish()
  } else {
    target.scrollIntoView()
    finish()
  }
}
