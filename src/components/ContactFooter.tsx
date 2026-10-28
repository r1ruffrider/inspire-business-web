import Todo, { SHOW_TODOS } from "@/components/Todo"
import { content } from "@/content"
import { isKeyboardClick, scrollToSection } from "@/lib/lenis"

const EMAIL = "info@inspirebusinesstechnology.com"

const EXPLORE = [
  { label: "Mission", href: "#mission" },
  { label: "Services", href: "#services" },
  { label: "Products", href: "#products" },
  { label: "About", href: "#about" },
  { label: "Request services", href: "#request-services" },
] as const

/** Opens the privacy note and brings it into view. */
function openPrivacyNote(keyboard: boolean) {
  const el = document.getElementById("privacy-note") as HTMLDetailsElement | null
  if (!el) return
  el.open = true
  scrollToSection("#privacy-note", { keyboard })
}

export default function ContactFooter() {
  return (
    <footer id="footer" className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="f-brand">
            <a
              href="#top"
              className="wordmark"
              translate="no"
              aria-label="Inspire Business Group, back to top"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection("#top", { keyboard: isKeyboardClick(e) })
              }}
            >
              Inspire{" "}
            <span className="text-gradient">Business Group</span>
            </a>
            <p>Inspire Business Group LLC is a technology and education venture studio.</p>
            <p>
              Prefer email?
              <br />
              <a className="f-mail" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </p>
            {SHOW_TODOS && <Todo what="Marlon: real logo file (SVG) to replace the wordmark text and the interim favicon" />}
            {SHOW_TODOS && <Todo what="Marlon: do you want partnership enquiries? If yes, add a form option or a footer line" />}
          </div>

          <nav className="f-col f-col1" aria-label="Explore">
            <p className="eyebrow">Explore</p>
            <ul>
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToSection(l.href, { keyboard: isKeyboardClick(e) })
                    }}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="f-col f-col2">
            <p className="eyebrow">Products</p>
            <ul>
              {content.products.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  {p.url ? <a href={p.url} rel="noopener" translate="no">{p.name}</a> : <span translate="no">{p.name}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer__base">
          <span className="inline-flex min-h-11 items-center">
            © {new Date().getFullYear()} Inspire Business Group LLC. All rights reserved.
          </span>
          <a
            href="#privacy-note"
            onClick={(e) => {
              e.preventDefault()
              openPrivacyNote(isKeyboardClick(e))
            }}
          >
            Privacy note
          </a>
        </div>
      </div>
    </footer>
  )
}
