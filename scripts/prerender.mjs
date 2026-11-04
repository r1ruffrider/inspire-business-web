// Build step (after `vite build` and `vite build --ssr`): writes the rendered
// page, the FAQPage JSON-LD (from the same data as the visible FAQ) and a
// preload for the Latin text font into dist/index.html. No network access.
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const dist = join(root, "dist")
const ssrDir = join(root, "dist-ssr")
const entry = readdirSync(ssrDir).find((f) => /^prerender-entry\.m?js$/.test(f))
if (!entry) throw new Error("prerender: dist-ssr/prerender-entry.js missing")
const { App, faq } = (await import(pathToFileURL(join(ssrDir, entry)).href)).default

const htmlPath = join(dist, "index.html")
let html = readFileSync(htmlPath, "utf8")
for (const marker of ["<!--app-html-->", "<!--faq-jsonld-->", "<!--font-preload-->"]) {
  if (!html.includes(marker)) throw new Error(`prerender: marker ${marker} missing from dist/index.html`)
}

const app = renderToString(createElement(App))
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
}
const font = readdirSync(join(dist, "assets")).find((f) => /^geist-latin-wght-normal-.*\.woff2$/.test(f))
const preload = font
  ? `<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin />`
  : ""

html = html
  .replace("<!--app-html-->", () => app)
  .replace("<!--faq-jsonld-->", () => `<script type="application/ld+json">${JSON.stringify(faqLd).replace(/</g, "\\u003c")}</script>`)
  .replace("<!--font-preload-->", () => preload)

writeFileSync(htmlPath, html)
rmSync(ssrDir, { recursive: true, force: true })
console.log(`prerender: ${app.length} chars of HTML, ${faq.length} FAQ entries, font preload ${font ? "added" : "skipped"}`)
