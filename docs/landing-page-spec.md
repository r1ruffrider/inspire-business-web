# Landing page spec (v2 refine)

Not shipped (`.vercelignore`). Tokens: DESIGN.md. Copy source: `src/content/site.ts`.

## Sections
| # | Section | id | Job | Notes |
|---|---|---|---|---|
| 1 | Hero | `#top` | What we do, for whom, what happens next, one action | Eyebrow "Inspire Business Group"; slogan "You envision it. We build it."; H1 "Websites, apps and brand identity for small businesses."; "Request services" + "See how it works"; index card of the three offers linking to each service |
| 2 | Services | `#services` | The three offers | Web design as the wide lead; App development and Brand identity as a list; Brand identity shows "Logo design" and the two tiers (Logo package, Full brand identity); each has a "Request ..." link that preselects it in the form |
| 3 | Process | `#process` | How a project runs, drawn | 5 icon stops on one line (vertical on phones); no durations; repeat CTA |
| 4 | Mission | (no id) | Quiet pull-quote | "The only thing between you and your dream is the technology in between. Let us build it." `<blockquote class="mission">`, padding `clamp(28px, 3.5vw, 40px)`, not `.section` |
| 5 | Products we build ourselves | `#products` | Proof that we ship software | Forge and Fluyo unlinked. Smart Home Certification name links to https://atomshott.com/ in a new tab. No renders |
| 6 | FAQ | `#faq` | Answers from site facts | Native details; same data feeds FAQPage JSON-LD and llms.txt |
| 7 | Request services | `#request-services` | Final CTA + form | Form unchanged except the service choices (Website, App, Brand identity (logo + branding)) |
| 8 | Footer | `#footer` | Contact, legal name, privacy note link | The one dark band; no street address |

## Team page

`/team` is its own prerendered document (`dist/team/index.html`), not a homepage anchor. Same header and footer. "Meet the team." is the page `h1` (`.h2` size), then the lede, then the sentence "Our team is AI-powered: everyone on this page except our founder is an AI agent." 17 photo cards in `public/team/`. Marlon Gibson has no bio. Alexandra Chen's bio is "Assesses risk and guides security controls." Marisol Reyes is Audio / Video Engineer. Request services links to `/#request-services`. No services, process, products, FAQ, mission quote, or form on this page. Nav and footer use rooted hrefs (`/#services`, `/work`, `/team`, `/#request-services`, wordmark `/`, privacy `/#privacy-note`).

## Work page

`/work` is a prerendered unused-concept page (`dist/work/index.html`). H1 "Selected work". One KornX case: not a client, no results, no outbound KornX link. Eight watermarked renders in `public/work/kornx/`, shown with `object-fit: contain`. Closing Request services links to `/#request-services`.

Mobile: on the homepage the sticky "Request services" bar appears after the hero button scrolls off and hides once the request section is in view. On `/team` it shows immediately and hides when the after-grid button comes into view. Hidden from 768 px. Safe-area padded.

## Motion
State changes only (see DESIGN.md). Nothing moves on scroll. Reduced motion = 0 ms.

## Assets and rights
- Fonts: Geist and Geist Mono, SIL Open Font License 1.1 (from @fontsource-variable, licence in src/assets/fonts/).
- Icons: Lucide (ISC licence), via lucide-react.
- Favicon, apple-touch icon, OG image: drawn in this repo (SVG paths / HTML rendered with headless Chrome). Temporary monogram.
- No photos, renders, stock or generated imagery. The old 3D product renders and the 150-frame hero sequence are deleted.

## Claims that need owner proof
None are shown. Missing proof, pricing, durations, founder and reply-time promise are in OWNER-TODO.md.

## Tested widths
1440x900, 390x844, 320x700 (headless Chrome), plus reduced motion and JavaScript off at 1440.
Screenshots: ~/projects/inspire-review/shots-v2/.
