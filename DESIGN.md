# Inspire Business Group: design system (v2 refine)

Source of truth for tokens: `src/styles/tokens.css` (the only file that defines colours, type, radii, spacing and
motion). This document explains them. Not shipped (`.vercelignore`).

## Direction
"A studio's project sheet." Light, warm paper; ink type set tight; one indigo accent used as a field (the
Process band, icon tiles, the first step) and for the one action; mono labels and numbers like a spec sheet.
Nothing moves on scroll. The page is still and reads top to bottom: what we do, how a project runs, one mission
line, what we build ourselves, the team, questions, then the request form.

Order: Hero, Services, Process, mission pull-quote, Products we build ourselves, Meet the team, FAQ, Request services (final CTA + form), Footer.
Each band has its own shape: hero = copy + index card, Services = wide lead + list, Process = drawn flow on the
tint, mission = one quiet pull-quote, Products = one compact strip, Team = a grid of initials cards, FAQ = heading + accordion, Request = sticky intro + form card, Footer = the one
dark band.

## Colour
| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | #FAFAF9 | page (warm neutral) | ink 17.09:1 |
| `--surface` | #FFFFFF | cards, inputs, tiles | |
| `--ink` | #0F172A | text | 17.09:1 on bg |
| `--ink-muted` | #475569 | body copy, labels | 7.26:1 on bg, 6.67:1 on tint |
| `--line` | #E7E5E4 | hairlines (decorative) | |
| `--line-strong` | #78716C | form control borders | 4.80:1 on white (non-text 3:1) |
| `--accent` | #4338CA | primary button, links, focus, mono labels, icons | 7.57:1 on bg; white on it 7.90:1 |
| `--accent-deep` | #3730A3 | hover/pressed | white on it 9.93:1 |
| `--accent-soft` | #EEF0FB | the one tinted band (Process), icon tiles, checked tiles | accent on it 6.96:1 |
| `--accent-line` | #C7CDF3 | hairlines on the tint, flow line (decorative) | |
| `--accent-on-dark` | #C7D2FE | labels in the footer | 11.97:1 on dark |
| `--dark` / `--on-dark` / `--on-dark-muted` | #0F172A / #F8FAFC / #CBD5E1 | footer (the one dark band) | 17.06:1 / 12.02:1 |
| `--error` / `--error-soft` | #B91C1C / #FEF2F2 | form errors only | 6.47:1 white, 5.91:1 soft |
| `--success` | #15803D | form success icon only | 5.02:1 |

The accent is Camila's indigo fallback because no logo file exists yet. When Marlon supplies a logo, change
`--accent`, `--accent-deep`, `--accent-soft`, `--accent-line` and `--accent-on-dark` together and re-check the
ratios. No gradients, glows or coloured headlines anywhere.

## Type
- Geist (variable, 400-700 used) for everything; Geist Mono for labels, step numbers, counters and the privacy
  version. Both self-hosted from `src/assets/fonts/` (Latin + Latin Extended subsets, SIL OFL 1.1, licence file
  alongside). No Google Fonts request. The Latin text face is preloaded by `scripts/prerender.mjs`.
- Scale: H1 36 -> 48 px (`--fs-h1`), weight 650, -0.035em, line-height 1.1. H2 28 -> 36 px. H3 22 px. Lead 17 -> 19 px.
  Body 17 px / 1.65. Small 15 px. Mono label 13 px. Measure ~65ch.
- Sentence case everywhere. One H1 per page. `text-wrap: balance` on headings.

## Shape and space
- Radius: control 10 px, panel 20 px, pill only for the "Logo design" tag.
- One shadow (`--shadow-panel`) for elevated panels only: hero index, Services lead, form card, menu.
- Container 1200 px; gutters 16 px (phone) / 24 px; safe-area insets respected on the wrap, nav, sticky CTA and footer.
- Section rhythm: `--section-y` 64 -> 112 px; Products is the compact band (48 -> 72 px).

## Motion (state only)
- Press: `scale(0.97)` on buttons, burger and service tiles, 120 ms ease-out (`--ease-out` = cubic-bezier(0.23,1,0.32,1)).
- Hover: colour, background and border change instantly (not animated); the CTA arrow nudges 2 px
  (transform, 150 ms). Menu enter: opacity 0 -> 1 and scale(0.95) -> 1, 200 ms, `transform-origin: top right`,
  via CSS transition + `@starting-style` (no keyframes). FAQ icon rotates 45deg, 200 ms. Error text fades in
  150 ms. Success panel enters from scale(0.98) + opacity. Sticky CTA: opacity + 12 px slide, 200 ms.
- Only transform and opacity animate (all under 300 ms, ease-out); colour, shadow and layout never do. Nothing is scroll-linked (no smooth scroll, parallax, pinning,
  scrubbing or fade-in on scroll). The only keyframes are the form's loading spinner.
- `prefers-reduced-motion: reduce`: every duration token is 0 ms, a global rule forces 0 ms on everything,
  nothing scales, the spinner stops.

## Components
- Button: primary (indigo, white label), secondary (white, indigo border/label), inverse; 48 px tall, 44 px small.
- Link: indigo, underlined, 44 px tall hit area.
- Icon tile: 48/40 px rounded square on the tint, Lucide icon 1.75 stroke, `currentColor`.
- Mono label: 13 px Geist Mono, sentence case, accent colour.
- Focus: 2 px indigo outline, 3 px offset (white on the dark footer).

## Brand mark (temporary)
"IB" monogram: white I and B on an indigo #4338CA rounded square, drawn with paths (no font dependency). Used in
`public/favicon.svg`, `public/apple-touch-icon.png`, the nav and footer wordmark (`src/components/Brand.tsx`) and
`public/og-image.jpg`. Wordmark is plain text. Flagged in OWNER-TODO.md until a real logo exists.

## No JavaScript
The request form is mounted in the browser only. The prerendered HTML (what a visitor with JavaScript off
sees) has, where the form sits, a `<noscript>` notice "The request form needs JavaScript, which is off in this browser."
and the mailto link, plus the privacy note. No `<form>` exists without JavaScript, so nothing can post to `/`.
