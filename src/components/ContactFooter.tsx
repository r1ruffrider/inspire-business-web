import { Wordmark } from "@/components/Brand"
import { content, EMAIL, LEGAL_NAME, navLinks } from "@/content"
import { scrollToSection } from "@/lib/scroll"

/** Opens the privacy note and brings it into view. */
function openPrivacyNote() {
  const el = document.getElementById("privacy-note") as HTMLDetailsElement | null
  if (!el) return
  el.open = true
  scrollToSection("#privacy-note")
}

export default function ContactFooter() {
  const explore = [...navLinks(content.team.length), { label: "Request services", href: "#request-services" }]
  return (
    <footer id="footer" className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="f-brand">
            <Wordmark
              onClick={(e) => {
                e.preventDefault()
                scrollToSection("#top")
              }}
            />
            <p>Websites, apps and brand identity for small businesses across the US.</p>
            <p>
              Prefer email?
              <br />
              <a className="f-mail" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </p>
          </div>

          <nav className="f-col f-col1" aria-label="Explore">
            <p className="mono-label">Explore</p>
            <ul>
              {explore.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToSection(l.href)
                    }}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="f-col f-col2">
            <p className="mono-label">Our own products</p>
            <ul>
              {content.products.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" translate="no">
                      {p.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span translate="no">{p.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer__base">
          <span className="footer__legal">
            © {new Date().getFullYear()} {LEGAL_NAME}. All rights reserved.
          </span>
          <a
            href="#privacy-note"
            onClick={(e) => {
              e.preventDefault()
              openPrivacyNote()
            }}
          >
            Privacy note
          </a>
        </div>
      </div>
    </footer>
  )
}
