import { useCallback, useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"
import { RequestCta } from "@/components/ui/actions"
import { isKeyboardClick, scrollToSection, startLenis, stopLenis } from "@/lib/lenis"

const LINKS = [
  { label: "Mission", href: "#mission" },
  { label: "Services", href: "#services" },
  { label: "Products", href: "#products" },
  { label: "About", href: "#about" },
] as const

/** Make the page interactive again NOW (not after React re-renders), so a focus call made
 * right after a menu navigation is not ignored by an inert #main. */
function releaseInert() {
  for (const el of [document.getElementById("main"), document.getElementById("footer"), document.querySelector<HTMLElement>(".skip-link")]) {
    if (el) el.inert = false
  }
}

const EMAIL = "info@inspirebusinesstechnology.com"
const SECTION_IDS = ["mission", "services", "products", "about"] as const

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string>("")
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  // Solid bar after 40px, and which section is current (aria-current).
  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      setScrolled(window.scrollY > 40)
      let current = ""
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id
      }
      // The request section is not a nav link, so it clears the highlight.
      const rs = document.getElementById("request-services")
      if (rs && rs.getBoundingClientRect().top <= window.innerHeight * 0.4) current = ""
      setActive(current)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) toggleRef.current?.focus()
  }, [])

  // While the menu is open: Escape closes it and returns focus to the toggle,
  // the page behind is inert, and the page does not scroll behind the panel.
  // overflow:hidden on html/body is never used (it would hide the scrollbar).
  useEffect(() => {
    if (!open) return
    const main = document.getElementById("main")
    const footer = document.getElementById("footer")
    if (main) main.inert = true
    if (footer) footer.inert = true
    // the skip link targets #main, which is inert while the menu is open
    const skip = document.querySelector<HTMLElement>(".skip-link")
    if (skip) skip.inert = true
    stopLenis()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close(true)
      }
    }
    const block = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) e.preventDefault()
    }
    const mq = window.matchMedia("(min-width: 1024px)")
    const onMq = () => {
      if (mq.matches) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("wheel", block, { passive: false })
    document.addEventListener("touchmove", block, { passive: false })
    mq.addEventListener("change", onMq)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("wheel", block)
      document.removeEventListener("touchmove", block)
      mq.removeEventListener("change", onMq)
      if (main) main.inert = false
      if (footer) footer.inert = false
      if (skip) skip.inert = false
      startLenis()
    }
  }, [open, close])

  const go = (href: string, keyboard: boolean) => {
    releaseInert()
    setOpen(false)
    startLenis()
    scrollToSection(href, { keyboard })
  }

  return (
    <header className={`nav ${scrolled || open ? "nav--solid" : ""}`}>
      <div className="wrap">
        <div className="nav__bar">
          <a
            href="#top"
            className="wordmark"
            aria-label="Inspire Business Group, back to top"
            translate="no"
            onClick={(e) => {
              e.preventDefault()
              go("#top", isKeyboardClick(e))
            }}
          >
            Inspire{" "}
            <span className="text-gradient">Business Group</span>
          </a>

          {/* Desktop nav: only claims space once there is room (lg) */}
          <nav className="nav__links" aria-label="Main">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={active === l.href.slice(1) ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  go(l.href, isKeyboardClick(e))
                }}
              >
                {l.label}
              </a>
            ))}
            <RequestCta size="sm" />
          </nav>

          <button
            ref={toggleRef}
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="menu" id="mobile-menu" ref={panelRef} aria-label="Main menu">
          <RequestCta block="always" onActivate={() => {
              releaseInert()
              setOpen(false)
              startLenis()
            }} />
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={active === l.href.slice(1) ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(l.href, isKeyboardClick(e))
              }}
            >
              {l.label}
            </a>
          ))}
          <p className="menu__mail">
            Prefer email? <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
        </nav>
      )}
    </header>
  )
}
