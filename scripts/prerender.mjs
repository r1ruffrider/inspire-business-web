// Build step (after `vite build` and `vite build --ssr`): writes the rendered
// homepage and /team into dist, plus the FAQPage JSON-LD (homepage only) and a
// preload for the Latin text font. No network access. No client router: each
// URL is its own HTML file, readable with JavaScript off.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
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
const shell = readFileSync(htmlPath, "utf8")
for (const marker of ["<!--app-html-->", "<!--faq-jsonld-->", "<!--font-preload-->"]) {
  if (!shell.includes(marker)) throw new Error(`prerender: marker ${marker} missing from dist/index.html`)
}

const home = renderToString(createElement(App, { page: "home" }))
const team = renderToString(createElement(App, { page: "team" }))
const work = renderToString(createElement(App, { page: "work" }))
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
const faqScript = `<script type="application/ld+json">${JSON.stringify(faqLd).replace(/</g, "\\u003c")}</script>`

function fill(appHtml, faqJson) {
  return shell
    .replace("<!--app-html-->", () => appHtml)
    .replace("<!--faq-jsonld-->", () => faqJson)
    .replace("<!--font-preload-->", () => preload)
}

const homeHtml = fill(home, faqScript)
let teamHtml = fill(team, "")
const teamHead = [
  [
    "<title>Websites, Apps &amp; Brand Identity | Inspire Business Group</title>",
    "<title>Meet the team | Inspire Business Group</title>",
  ],
  [
    'content="Inspire Business Group designs and builds websites, apps and brand identity, including logo design, for small businesses across the US. Start with a free consultation."',
    'content="The people who handle a project from the first request through launch. Inspire Business Group designs and builds websites, apps and brand identity for small businesses across the US."',
  ],
  [
    '<link rel="canonical" href="https://www.inspirebusinesstechnology.com/" />',
    '<link rel="canonical" href="https://www.inspirebusinesstechnology.com/team" />',
  ],
  [
    '<meta property="og:url" content="https://www.inspirebusinesstechnology.com/" />',
    '<meta property="og:url" content="https://www.inspirebusinesstechnology.com/team" />',
  ],
  [
    '<meta property="og:title" content="Websites, apps and brand identity for small businesses" />',
    '<meta property="og:title" content="Meet the team" />',
  ],
  [
    '<meta name="twitter:title" content="Websites, apps and brand identity for small businesses" />',
    '<meta name="twitter:title" content="Meet the team" />',
  ],
  [
    'content="Web design, app development and brand identity (logo design and full brand identity) for small businesses across the US."',
    'content="The people who handle a project from the first request through launch. Inspire Business Group designs and builds websites, apps and brand identity for small businesses across the US."',
  ],
]
for (const [from, to] of teamHead) {
  if (!teamHtml.includes(from)) throw new Error(`prerender: team head string missing: ${from.slice(0, 60)}`)
  teamHtml = teamHtml.replaceAll(from, to)
}

if (homeHtml.includes('id="team"')) throw new Error("prerender: homepage still contains #team")
if (!teamHtml.includes("Meet the team.")) throw new Error("prerender: /team missing the team heading")
if (teamHtml.includes('id="products"') || teamHtml.includes('id="process"') || teamHtml.includes('id="faq"')) {
  throw new Error("prerender: /team contains a homepage section")
}
if (!teamHtml.includes('href="/#request-services"')) throw new Error("prerender: /team CTA does not point at the homepage form")
if (!teamHtml.includes("<h1 class=\"h2\" id=\"team-h\">")) throw new Error("prerender: /team heading is not an h1")
if (!teamHtml.includes('content="Meet the team"')) throw new Error("prerender: og:title")
if (teamHtml.includes("FAQPage") || teamHtml.includes('"@type":"Person"') || teamHtml.includes('"@type": "Person"')) {
  throw new Error("prerender: /team has FAQ or Person schema")
}
if (!teamHtml.includes("<title>Meet the team | Inspire Business Group</title>")) {
  throw new Error("prerender: /team title was not set")
}

let workHtml = fill(work, "")
const workHead = [
  [
    "<title>Websites, Apps &amp; Brand Identity | Inspire Business Group</title>",
    "<title>Selected work | Inspire Business Group</title>",
  ],
  [
    'content="Inspire Business Group designs and builds websites, apps and brand identity, including logo design, for small businesses across the US. Start with a free consultation."',
    'content="Unused concept: logo package, brand applications, and two homepage directions for a waste recovery company. KornX did not commission or use this design."',
  ],
  [
    '<link rel="canonical" href="https://www.inspirebusinesstechnology.com/" />',
    '<link rel="canonical" href="https://www.inspirebusinesstechnology.com/work" />',
  ],
  [
    '<meta property="og:url" content="https://www.inspirebusinesstechnology.com/" />',
    '<meta property="og:url" content="https://www.inspirebusinesstechnology.com/work" />',
  ],
  [
    '<meta property="og:title" content="Websites, apps and brand identity for small businesses" />',
    '<meta property="og:title" content="Selected work" />',
  ],
  [
    '<meta name="twitter:title" content="Websites, apps and brand identity for small businesses" />',
    '<meta name="twitter:title" content="Selected work" />',
  ],
  [
    'content="Web design, app development and brand identity (logo design and full brand identity) for small businesses across the US."',
    'content="Unused concept: logo package, brand applications, and two homepage directions for a waste recovery company. KornX did not commission or use this design."',
  ],
]
for (const [from, to] of workHead) {
  if (!workHtml.includes(from)) throw new Error(`prerender: work head string missing: ${from.slice(0, 60)}`)
  workHtml = workHtml.replaceAll(from, to)
}

const workTitle = "KornX: brand identity and website concept for a waste recovery company (unused concept)"
const workNote =
  "Concept work by Marlon Gibson. KornX did not commission or use this design, and the KornX name belongs to its owner. Images are watermarked concept renders."
if (!workHtml.includes(workTitle)) throw new Error("prerender: /work missing the case title")
if (!workHtml.includes(workNote)) throw new Error("prerender: /work missing the concept note")
if ((workHtml.match(/<img /g) || []).length !== 8) throw new Error("prerender: /work should have 8 images")
if (workHtml.includes("FAQPage") || /https?:\/\/(?!www\.inspirebusinesstechnology\.com)[^"'\s]*kornx/i.test(workHtml)) {
  throw new Error("prerender: /work has FAQ schema or a KornX link")
}
if (workHtml.includes('id="team"') || workHtml.includes('id="products"')) {
  throw new Error("prerender: /work contains another page section")
}
if (!homeHtml.includes('href="/work"') || !teamHtml.includes('href="/work"') || !workHtml.includes('href="/work"')) {
  throw new Error("prerender: Work link missing from a page")
}

writeFileSync(htmlPath, homeHtml)
mkdirSync(join(dist, "team"), { recursive: true })
writeFileSync(join(dist, "team", "index.html"), teamHtml)
mkdirSync(join(dist, "work", "kornx"), { recursive: true })
writeFileSync(join(dist, "work", "index.html"), workHtml)
rmSync(ssrDir, { recursive: true, force: true })
console.log(
  `prerender: home ${home.length} chars, /team ${team.length} chars, /work ${work.length} chars, ${faq.length} FAQ entries, font preload ${font ? "added" : "skipped"}`,
)
