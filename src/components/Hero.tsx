import { RequestCta, SeeLink } from "@/components/ui/actions"
import { content } from "@/content"
import { scrollToSection } from "@/lib/scroll"

/**
 * The first screen: the only <h1>, who it's for and what happens next, one
 * primary action and a quiet secondary link. Still and content-sized (no 100vh,
 * nothing moves on scroll). The right column is an index of the three offers,
 * each a link to its place in Services.
 */
export default function Hero() {
  return (
    <section id="top" className="hero" aria-labelledby="h1">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <div className="hero__brand">
            <p className="eyebrow">Inspire Business Group</p>
            <p className="hero__slogan">You envision it. We build it.</p>
          </div>
          <h1 className="h-display" id="h1" tabIndex={-1}>
            Websites, apps and brand identity for small businesses.
          </h1>
          <p className="lead">
            We turn that into the website, app and brand your customers see first, for small
            businesses across the US. Tell us what you have in mind, and we start with a free
            consultation.
          </p>
          <div className="hero__cta">
            <RequestCta block="phone" id="hero-cta" />
            <SeeLink href="#process">See how it works</SeeLink>
          </div>
        </div>

        <nav className="hero__index" aria-label="What we do">
          <p className="mono-label">What we do</p>
          <ol>
            {content.services.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#svc-${s.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection(`#svc-${s.id}`)
                  }}
                >
                  <span className="mono-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="hero__index-name">{s.name}</span>
                  {s.also && <span className="hero__index-also">{s.also}</span>}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  )
}
