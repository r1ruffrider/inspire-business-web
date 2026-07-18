import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { scrollToSection } from "@/lib/lenis"

const LINKS = [
  { label: "Mission", href: "#mission" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const go = (href: string) => {
    scrollToSection(href)
    setOpen(false)
  }

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "bg-background/70 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            go("#top")
          }}
          className="font-extrabold tracking-tight text-white shrink-0"
        >
          Inspire <span className="text-gradient">Business Group</span>
        </a>

        {/* Desktop nav — only claims space once there's room for it */}
        <div className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => {
                e.preventDefault()
                go(l.href)
              }}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Mobile/tablet toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden text-white p-2 -mr-2"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="container mx-auto flex flex-col px-6 py-4 gap-4 text-muted-foreground">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => {
                  e.preventDefault()
                  go(l.href)
                }}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
