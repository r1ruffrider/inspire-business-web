import App from "./App.tsx"
import { DEFAULTS } from "@/content/site"

// Build-time only: scripts/prerender.mjs renders <App/> to static HTML (so the
// content is readable without JavaScript) and builds the FAQPage JSON-LD from
// the same FAQ data the page shows. No server code is imported here.
const entry = { App, faq: DEFAULTS.faq }
export default entry
