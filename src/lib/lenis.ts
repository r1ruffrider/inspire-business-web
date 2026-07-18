import Lenis from "lenis"

let lenisInstance: Lenis | null = null

export function initLenis() {
  if (lenisInstance) return lenisInstance
  const lenis = new Lenis({ lerp: 0.08 })
  const raf = (time: number) => {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  // Dragging the native scrollbar bypasses Lenis's internal target tracking,
  // so it snaps back to a stale position. Re-sync when the browser (not
  // Lenis) drove the scroll. See darkroomengineering/lenis#168, #107.
  window.addEventListener(
    "scroll",
    () => {
      if (!lenis.isScrolling) {
        lenis.scrollTo(window.scrollY, { immediate: true })
      }
    },
    { passive: true },
  )

  lenisInstance = lenis
  return lenis
}

export function scrollToSection(selector: string) {
  if (lenisInstance) {
    lenisInstance.scrollTo(selector, { offset: 0 })
  } else {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" })
  }
}
