import { isWorstCase } from "@/content"
import "./dev-switch.css"

/**
 * Development-only "Demo data / Worst case" switch (break-ui). App renders it
 * only behind import.meta.env.DEV, so it is dead code in a production build.
 * Collapsed by default so it never covers the page under test.
 */
export default function DevSwitch() {
  return (
    <details className="dev-switch">
      <summary>dev data</summary>
      <div>
        <a href={`${window.location.pathname}${window.location.hash}`} aria-current={!isWorstCase ? "true" : undefined}>
          Demo data
        </a>
        <a href={`?data=worst${window.location.hash}`} aria-current={isWorstCase ? "true" : undefined}>
          Worst case
        </a>
      </div>
    </details>
  )
}
