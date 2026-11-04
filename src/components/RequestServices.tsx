import { AppWindow, Monitor, PenTool, type LucideIcon } from "lucide-react"
import RequestForm from "@/components/request/RequestForm"
import { content, EMAIL } from "@/content"

const ICONS: Record<string, LucideIcon> = {
  website: Monitor,
  app: AppWindow,
  brand: PenTool,
}

/** Request services: the final call to action and the form. Words: COPY.md section 3. */
export default function RequestServices() {
  return (
    <section id="request-services" className="section section--request" aria-labelledby="rs-heading">
      <div className="wrap rs">
        <div className="rs__intro">
          <p className="mono-label">Start a project</p>
          <h2 className="h2" id="rs-heading" tabIndex={-1}>
            Request services
          </h2>
          <p className="lead">
            Tell us about your project. Choose a website, an app, brand identity or any mix, and add
            a few details. Your request goes to {EMAIL}.
          </p>
          <p className="rs__next">
            <strong>What happens next.</strong> Your request is sent to {EMAIL}. You won&rsquo;t
            get an automatic confirmation email.
          </p>
          <ul className="mini" aria-label="Services">
            {content.services.map((s) => {
              const Icon = ICONS[s.id] ?? PenTool
              return (
                <li key={s.id}>
                  <Icon strokeWidth={1.75} aria-hidden="true" />
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
