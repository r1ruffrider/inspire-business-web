import { useEffect, useState } from "react"
import { RequestCta } from "@/components/ui/actions"

/**
 * Phones only (CSS hides it from 768px): a bottom "Request services" bar that
 * appears once the hero's button has scrolled off, and stays hidden from the
 * moment the request form comes into view. It is a state change (opacity and a
 * short slide, 200ms), not scroll-linked motion; under reduced motion it is
 * instant. Padded for the home indicator with env(safe-area-inset-bottom).
 */
export default function StickyCta() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
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
  }, [])

  return (
    <div className={`sticky-cta${show ? " is-on" : ""}`} aria-hidden={!show} inert={!show}>
      <RequestCta block="always" tabIndex={show ? undefined : -1} />
    </div>
  )
}
