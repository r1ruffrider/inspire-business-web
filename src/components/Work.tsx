import { RequestCta } from "@/components/ui/actions"

const NOTE =
  "Concept work by Marlon Gibson. KornX did not commission or use this design, and the KornX name belongs to its owner. Images are watermarked concept renders."

type Shot = {
  src: string
  alt: string
  caption: string
  width: number
  height: number
  /** Lead and the closing wide plate span the row. Pairs alternate 7/5 then 5/7. */
  span: "all" | 7 | 5
  eager?: boolean
}

const SHOTS: Shot[] = [
  {
    src: "/work/kornx/kornx-logo-service-icons.webp",
    alt: "KornX concept logo on a dark plate surrounded by red hexagon service icons, watermarked concept render",
    caption: "Logo and service icon set",
    width: 1200,
    height: 1200,
    span: "all",
    eager: true,
  },
  {
    src: "/work/kornx/kornx-logo-lockup-ship.webp",
    alt: "KornX concept logo lockup and icon row over a cargo ship in a foggy harbor, watermarked concept render",
    caption: "Logo lockup in harbor",
    width: 1200,
    height: 1200,
    span: 7,
  },
  {
    src: "/work/kornx/kornx-fleet-truck-train-barge.webp",
    alt: "KornX concept livery on a truck, a train, and a barge, watermarked concept render",
    caption: "Fleet livery",
    width: 1200,
    height: 1200,
    span: 5,
  },
  {
    src: "/work/kornx/kornx-fleet-livery-wide.webp",
    alt: "KornX concept fleet livery across a tanker, a locomotive, and a barge, with service icons, watermarked concept render",
    caption: "Fleet across tanker, train, and barge",
    width: 1200,
    height: 1200,
    span: 5,
  },
  {
    src: "/work/kornx/kornx-facility-tower.webp",
    alt: "Aerial render of a recovery facility with a KornX concept-branded tower, watermarked",
    caption: "Facility signage",
    width: 1200,
    height: 1200,
    span: 7,
  },
  {
    src: "/work/kornx/kornx-logo-plaque.webp",
    alt: "KornX concept logo on a black plaque with red service icons, watermarked concept render",
    caption: "Logo plaque",
    width: 1200,
    height: 1200,
    span: 7,
  },
  {
    src: "/work/kornx/kornx-boardroom-display.webp",
    alt: "KornX concept logo projected over a boardroom table, watermarked concept render",
    caption: "Boardroom display",
    width: 1200,
    height: 1200,
    span: 5,
  },
  {
    src: "/work/kornx/kornx-ship-hull-wide.webp",
    alt: "KornX concept logo and service icons on a ship hull at a dock, watermarked concept render",
    caption: "Environmental application",
    width: 1200,
    height: 669,
    span: "all",
  },
]

/**
 * Unused KornX concept. Not a client project: no results, no endorsement, no outbound link.
 */
export default function Work() {
  return (
    <section id="work" className="section work-page" aria-labelledby="work-h">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Work</p>
          <h1 className="h2" id="work-h">
            Selected work
          </h1>
        </div>

        <article className="work-case">
          <h2 className="h2 work-case__title">
            KornX: brand identity and website concept for a waste recovery company (unused concept)
          </h2>
          <p className="work-note">{NOTE}</p>
          <p className="work-scope">Scope: logo package, brand applications, and two homepage directions.</p>
          <p className="work-scope">
            Homepage directions explored: “Waste less. Recover more.” and “Every material has a next life.”
          </p>

          <div className="work-gallery">
            {SHOTS.map((shot) => (
              <figure key={shot.src} className={`work-fig work-fig--${shot.span}`}>
                <img
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  loading={shot.eager ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={shot.eager ? "high" : undefined}
                />
                <figcaption>{shot.caption}</figcaption>
              </figure>
            ))}
          </div>
        </article>

        <div className="work-close">
          <h2 className="h2">Want a brand like this for your business?</h2>
          <RequestCta />
        </div>
      </div>
    </section>
  )
}
