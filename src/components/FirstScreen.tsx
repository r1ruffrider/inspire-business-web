import ProofStrip from "@/components/ProofStrip"
import { RequestCta, SeeLink } from "@/components/ui/actions"

/**
 * The static first-screen layer: the only <h1> on the page, the subhead, one
 * primary action and a quiet secondary link. It is the overlay of the hero
 * (sibling of the four scrub lines, never inside them) and is also what the
 * static (reduced-motion / slow connection) hero shows. Words: COPY.md 1.2, 1.3.
 */
export default function FirstScreen() {
  return (
    <>
      <div className="hero__scrim" />
      <div className="wrap hero__inner">
        <div className="hero__copy">
          <h1 className="h-display" id="h1">
            Websites, logos and branding for your business.
          </h1>
          <p className="lead">
            <span translate="no">Inspire Business Group</span> is a technology and education
            venture studio. We also build <span translate="no">Forge</span>,{" "}
            <span translate="no">Fluyo</span> and <span translate="no">Smart Home Certification</span>.
          </p>
          <div className="hero__cta">
            <RequestCta block="phone" />
            <SeeLink />
          </div>
        </div>
        <ProofStrip />
      </div>
    </>
  )
}
