import { ArrowRight, Hexagon, Layers, Monitor, type LucideIcon } from "lucide-react"
import Todo, { SHOW_TODOS } from "@/components/Todo"
import { PRESELECT_EVENT } from "@/components/ui/actions"
import { content } from "@/content"
import { isKeyboardClick, scrollToSection } from "@/lib/lenis"

const ICONS: Record<string, LucideIcon> = {
  website: Monitor,
  logo: Hexagon,
  branding: Layers,
}

/** Services: names only (COPY 2.3). A list, not three cards. */
export default function Services() {
  const services = content.services
  if (services.length === 0) return null
  return (
    <section id="services" className="section rule anchor" aria-labelledby="services-h">
      <div className="wrap services">
        <div className="stack content-start">
          <p className="eyebrow">Services</p>
          <h2 className="h2" id="services-h">
            What you can request.
          </h2>
          {SHOW_TODOS && <Todo what="Marlon: what each service includes, if you want it stated (none is claimed)" />}
        </div>
        <ul className="svc-list">
          {services.map((s, i) => {
            const Icon = ICONS[s.id] ?? Layers
            return (
              <li className="svc-row" key={s.id}>
                <span className="num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="nm">
                  <Icon className="ico" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="h3">{s.name}</h3>
                </div>
                <a
                  className="go"
                  href="#request-services"
                  aria-label={`Request services: ${s.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    window.dispatchEvent(new CustomEvent(PRESELECT_EVENT, { detail: { service: s.id } }))
                    scrollToSection("#request-services", { keyboard: isKeyboardClick(e) })
                  }}
                >
                  <span className="t">Request</span>
                  <ArrowRight aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
