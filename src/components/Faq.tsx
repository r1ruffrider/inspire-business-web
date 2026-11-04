import { Plus } from "lucide-react"
import { content } from "@/content"

/** FAQ from site facts only. Native <details>: works without JavaScript. */
export default function Faq() {
  const items = content.faq
  if (items.length === 0) return null
  return (
    <section id="faq" className="section" aria-labelledby="faq-h">
      <div className="wrap faq">
        <div className="sec-head">
          <p className="mono-label">FAQ</p>
          <h2 className="h2" id="faq-h">
            Questions, answered.
          </h2>
        </div>
        <div className="faq__list">
          {items.map((f, i) => (
            <details className="faq__item" key={`${f.q}-${i}`}>
              <summary>
                <span>{f.q}</span>
                <Plus className="faq__icon" aria-hidden="true" strokeWidth={1.75} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
