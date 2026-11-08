import { useCallback, useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"
import { Wordmark } from "@/components/Brand"
import { RequestCta } from "@/components/ui/actions"
import { content, EMAIL, navLinks } from "@/content"
import { isSamePage, scrollSelector, type PageId } from "@/lib/page"
import { scrollToSection } from "@/lib/scroll"

/** Make the page interactive again NOW (not after React re-renders), so a focus call made
 * right after a menu navigation is not ignored by an inert #main. */
function releaseInert() {
  for (const el of [document.getElementById("main"), document.getElementById("footer"), document.querySelector<HTMLElement>(".skip-link")]) {
    if (el) el.inert = false
  }
}

export default function Nav({ page }: { page: PageId }) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) toggleRef.current?.focus()
  }, [])

  // While the menu is open: Escape closes it and returns focus to the toggle, a click
  // outside closes it, the page behind is inert, and the page does not scroll behind it.
  useEffect(() => {
    if (!open) return
    const main = document.getElementById("main")
    const footer = document.getElementById("footer")
    const skip = document.querySelector<HTMLElement>(".skip-link")
    for (const el of [main, footer, skip]) if (el) el.inert = true

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close(true)
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !toggleRef.current?.contains(t)) close(false)
    }
    const block = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) e.preventDefault()
    }
    const mq = window.matchMedia("(min-width: 1024px)")
    const onMq = () => {
      if (mq.matches) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("wheel", block, { passive: false })
    document.addEventListener("touchmove", block, { passive: false })
    mq.addEventListener("change", onMq)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("wheel", block)
      document.removeEventListener("touchmove", block)
      mq.removeEventListener("change", onMq)
      for (const el of [main, footer, skip]) if (el) el.inert = false
    }
  }, [open, close])

  const go = (href: string) => {
    releaseInert()
    setOpen(false)
    scrollToSection(href)
  }

  const links = navLinks(content.team.length)

  return (
    <header className="nav">
      <div className="wrap">
        <div className="nav__bar">
          <Wordmark
            href="/"
            ariaLabel={page === "team" ? "Inspire Business Group, home" : "Inspire Business Group, back to top"}
            onClick={(e) => {
              if (!isSamePage("/", page)) return
              e.preventDefault()
              go("#top")
            }}
          />

          <nav className="nav__links" aria-label="Main">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={page === "team" && l.href === "/team" ? "page" : undefined}
                onClick={(e) => {
                  if (!isSamePage(l.href, page)) return
                  e.preventDefault()
                  go(scrollSelector(l.href))
                }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="nav__end">
            <RequestCta size="sm" className="nav__cta" />
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
      </div>

      {open && (
        <nav className="menu" id="mobile-menu" ref={panelRef} aria-label="Main menu">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={page === "team" && l.href === "/team" ? "page" : undefined}
              onClick={(e) => {
                if (!isSamePage(l.href, page)) return
                e.preventDefault()
                go(scrollSelector(l.href))
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
