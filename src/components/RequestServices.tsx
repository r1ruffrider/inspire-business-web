import { Hexagon, Layers, Monitor, type LucideIcon } from "lucide-react"
import RequestForm from "@/components/request/RequestForm"
import Todo, { SHOW_TODOS } from "@/components/Todo"
import { content } from "@/content"

const EMAIL = "info@inspirebusinesstechnology.com"

const ICONS: Record<string, LucideIcon> = {
  website: Monitor,
  logo: Hexagon,
  branding: Layers,
}

/**
 * Request services: the section shell. Phase 1 renders the intro column, the
 * privacy note and the form slot (a stub). It owns no state and App passes it
 * nothing. Words: COPY.md section 3.
 */
export default function RequestServices() {
  return (
    <section id="request-services" className="section rule" aria-labelledby="rs-heading">
      <div className="wrap rs">
        <div className="rs__intro">
          <p className="eyebrow">Start a project</p>
          <h2 className="h2" id="rs-heading" tabIndex={-1}>
            Request services
          </h2>
          <p className="lead">
            Tell us about your project. Choose a website, a logo, business branding or any mix,
            and add a few details. Your request goes to {EMAIL}.
          </p>
          <p className="rs__next">
            <strong>What happens next.</strong> Your request is sent to {EMAIL}. You won&rsquo;t
            get an automatic confirmation email.{" "}
            {SHOW_TODOS && <Todo what="Marlon: who replies to requests and whether to promise a reply, a call or a time" />}
          </p>
          <ul className="mini" aria-label="Services">
            {content.services.map((s) => {
              const Icon = ICONS[s.id] ?? Layers
              return (
                <li key={s.id}>
                  <Icon strokeWidth={1.6} aria-hidden="true" />
                  {s.name}
                </li>
              )
            })}
          </ul>
          <p className="fallback">
            Prefer email?
            <br />
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
        </div>

        <div className="rs__main">
          <div className="card">
            <RequestForm />
          </div>
        </div>
      </div>
    </section>
  )
}
