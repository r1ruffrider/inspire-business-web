import { useEffect, useState } from "react"
import { RequestCta } from "@/components/ui/actions"
import type { PageId } from "@/lib/page"

/**
 * Phones only (CSS hides it from 768px). Homepage: appears once the hero button
 * has scrolled off, and hides once the request form comes into view. /team: shown
 * immediately (there is no hero button) and hides once the after-grid Request
 * services control comes into view. Opacity and a short slide, 200ms; instant
 * under reduced motion. Padded for the home indicator.
 */
export default function StickyCta({ page = "home" }: { page?: PageId }) {
  const [show, setShow] = useState(page === "team")

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      if (page === "team") {
        const cta = document.querySelector(".team__cta")
        if (!cta) {
          setShow(true)
          return
        }
        setShow(cta.getBoundingClientRect().top >= window.innerHeight)
        return
      }
      const cta = document.getElementById("hero-cta")
      const form = document.getElementById("request-services")
      if (!cta || !form) return
      const heroGone = cta.getBoundingClientRect().bottom < 0
      const formSeen = form.getBoundingClientRect().top < window.innerHeight
      setShow(heroGone && !formSeen)
    }
    const on = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener("scroll", on, { passive: true })
    window.addEventListener("resize", on, { passive: true })
    return () => {
      window.removeEventListener("scroll", on)
      window.removeEventListener("resize", on)
    }
  }, [page])

  return (
    <div className={`sticky-cta${show ? " is-on" : ""}`} aria-hidden={!show} inert={!show}>
      <RequestCta block="always" tabIndex={show ? undefined : -1} />
    </div>
  )
}
