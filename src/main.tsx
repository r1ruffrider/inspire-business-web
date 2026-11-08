import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { scrollToSection } from "@/lib/scroll"

// The production HTML already contains the whole page (scripts/prerender.mjs).
// React replaces it with the identical live tree on mount (no hydration), so a
// visitor never sees a swap.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A link such as /#request-services: jump to it once React has rendered and
// focus its heading.
if (window.location.hash.length > 1) {
  const hash = window.location.hash
  const go = () =>
    requestAnimationFrame(() => {
      if (hash === "#privacy-note") {
        const note = document.getElementById("privacy-note")
        if (note instanceof HTMLDetailsElement) note.open = true
      }
      scrollToSection(hash, { updateHash: false })
    })
  if (document.readyState === "complete") go()
  else window.addEventListener("load", go, { once: true })
}
