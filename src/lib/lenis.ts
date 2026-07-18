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
