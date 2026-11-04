import { Code2, FileSignature, MessagesSquare, PenTool, Rocket, type LucideIcon } from "lucide-react"
import { RequestCta } from "@/components/ui/actions"
import { content } from "@/content"

const ICONS: LucideIcon[] = [MessagesSquare, FileSignature, PenTool, Code2, Rocket]

/**
 * How a project runs, drawn as a flow: icon stops on one line (horizontal on
 * wide screens, vertical on phones). No durations: none are sourced.
 */
export default function Process() {
  const steps = content.process
  if (steps.length === 0) return null
  return (
    <section id="process" className="section section--tint" aria-labelledby="process-h">
      <div className="wrap">
        <div className="sec-head sec-head--row">
          <div>
            <p className="mono-label">Process</p>
            <h2 className="h2" id="process-h">
              How a project runs.
            </h2>
          </div>
          <RequestCta variant="secondary" />
        </div>

        <ol className="flow">
          {steps.map((s, i) => {
            const Icon = ICONS[i] ?? Rocket
            return (
              <li className="flow__step" key={`${s.name}-${i}`}>
                <span className="flow__node" aria-hidden="true">
                  <Icon strokeWidth={1.75} />
                </span>
                <div className="flow__txt">
                  <span className="mono-num">Step {String(i + 1).padStart(2, "0")}</span>
                  <h3 className="flow__name">{s.name}</h3>
                  {s.line && <p>{s.line}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
