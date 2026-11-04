# Landing page spec (v2 refine)

Not shipped (`.vercelignore`). Tokens: DESIGN.md. Copy source: `src/content/site.ts`.

## Sections
| # | Section | id | Job | Notes |
|---|---|---|---|---|
| 1 | Hero | `#top` | What we do, for whom, what happens next, one action | H1 "Websites, apps and brand identity for small businesses."; "Request services" + "See how it works"; index card of the three offers linking to each service |
| 2 | Services | `#services` | The three offers | Web design as the wide lead; App development and Brand identity as a list; Brand identity shows "Logo design" and the two tiers (Logo package, Full brand identity); each has a "Request ..." link that preselects it in the form |
| 3 | Process | `#process` | How a project runs, drawn | 5 icon stops on one line (vertical on phones); no durations; repeat CTA |
| 4 | Products we build ourselves | `#products` | Proof that we ship software | Forge, Fluyo, Smart Home Certification as neutral tiles (name + one line); no renders |
| 5 | FAQ | `#faq` | Answers from site facts | Native details; same data feeds FAQPage JSON-LD and llms.txt |
| 6 | Request services | `#request-services` | Final CTA + form | Form unchanged except the service choices (Website, App, Brand identity (logo + branding)) |
| 7 | Footer | `#footer` | Contact, legal name, privacy note link | The one dark band; no street address |

Mobile: sticky bottom "Request services" bar appears after the hero button scrolls off and hides once the
request section is in view; safe-area padded. Nav keeps "Request services" visible beside the menu button.

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
