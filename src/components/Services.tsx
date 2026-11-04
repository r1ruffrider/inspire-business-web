import { AppWindow, ArrowRight, Monitor, PenTool, type LucideIcon } from "lucide-react"
import { PRESELECT_EVENT } from "@/components/ui/actions"
import { content } from "@/content"
import type { ServiceItem } from "@/content/types"
import { scrollToSection } from "@/lib/scroll"

const ICONS: Record<string, LucideIcon> = {
  website: Monitor,
  app: AppWindow,
  brand: PenTool,
}

function RequestLink({ s }: { s: ServiceItem }) {
  return (
    <a
      className="link svc__go"
      href="#request-services"
      aria-label={`Request ${s.name}`}
      onClick={(e) => {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(PRESELECT_EVENT, { detail: { service: s.id } }))
        scrollToSection("#request-services")
      }}
    >
      Request {s.name.toLowerCase()}
      <ArrowRight aria-hidden="true" />
    </a>
  )
}

/** Services: a wide lead (the first service) plus a list, not three equal cards. */
export default function Services() {
  const [lead, ...rest] = content.services
  if (!lead) return null
  const LeadIcon = ICONS[lead.id] ?? Monitor
  return (
    <section id="services" className="section" aria-labelledby="services-h">
      <div className="wrap">
        <div className="sec-head">
          <p className="mono-label">Services</p>
          <h2 className="h2" id="services-h">
            Three things we make, start to finish.
          </h2>
        </div>

        <div className="svc-grid">
          <article className="svc-lead" id={`svc-${lead.id}`} aria-labelledby={`svc-${lead.id}-h`}>
            <span className="icon-tile" aria-hidden="true">
              <LeadIcon strokeWidth={1.75} />
            </span>
            <span className="mono-num" aria-hidden="true">01</span>
            <h3 className="h3 svc-lead__name" id={`svc-${lead.id}-h`}>
              {lead.name}
            </h3>
            {lead.line && <p className="body">{lead.line}</p>}
            <RequestLink s={lead} />
          </article>

          <ul className="svc-list">
            {rest.map((s, i) => {
              const Icon = ICONS[s.id] ?? PenTool
              return (
                <li className="svc-row" key={s.id} id={`svc-${s.id}`}>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon strokeWidth={1.75} />
                  </span>
                  <div className="svc-row__body">
                    <p className="svc-row__top">
                      <span className="mono-num" aria-hidden="true">
                        {String(i + 2).padStart(2, "0")}
                      </span>
                      {s.also && <span className="tag">{s.also}</span>}
                    </p>
                    <h3 className="h3">{s.name}</h3>
                    {s.line && <p className="body">{s.line}</p>}
                    {s.tiers && s.tiers.length > 0 && (
                      <dl className="tiers">
                        {s.tiers.map((t, k) => (
                          <div key={`${t.name}-${k}`}>
                            <dt>{t.name}</dt>
                            {t.line && <dd>{t.line}</dd>}
                          </div>
                        ))}
                      </dl>
                    )}
                    <RequestLink s={s} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
