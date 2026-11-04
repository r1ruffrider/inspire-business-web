# Owner to-do list (not shipped)

Internal file. It is listed in `.vercelignore`, is not in `public/`, and never reaches `dist/`.
Written Wed Nov 4, 2026 (UTC+3) by Daniela on branch `feature/pro-refine-v2`, from commit `c5b7ed2`.

## 1. The 18 TODOs that were visible on the preview, moved here verbatim

These appeared on the page as dashed "TODO" chips (preview builds with `VITE_SHOW_TODOS=1`). Every chip and the
`<Todo>` component are now removed from the code. Text is exactly as rendered ("TODO" + the note); where it came
from in c5b7ed2 is in brackets.

### Hero proof strip (removed with the strip)
1. TODO Marlon: client or partner logos (SVG, with permission) [src/components/ProofStrip.tsx]
2. TODO Marlon: one publishable number, with date and source [src/components/ProofStrip.tsx]
3. TODO Marlon: one named client result, with date [src/components/ProofStrip.tsx]

### Services
4. TODO Marlon: what each service includes, if you want it stated (none is claimed) [src/components/Services.tsx]

### Products (Forge, Fluyo, Smart Home Certification)
5. TODO Marlon: Forge status and URL (chip and link render only if true) [src/components/ProductsSection.tsx]
6. TODO Marlon: Fluyo status and URL (chip and link render only if true) [src/components/ProductsSection.tsx]
7. TODO Marlon: which languages Fluyo teaches [src/components/ProductsSection.tsx]
8. TODO Marlon: Smart Home Certification status and URL (chip and link render only if true) [src/components/ProductsSection.tsx]

### Request services
9. TODO Marlon: who replies to requests and whether to promise a reply, a call or a time [src/components/RequestServices.tsx]

### Footer
10. TODO Marlon: real logo file (SVG) to replace the wordmark text and the interim favicon [src/components/ContactFooter.tsx]
11. TODO Marlon: do you want partnership enquiries? If yes, add a form option or a footer line [src/components/ContactFooter.tsx]

### Privacy note (the sentences they sit next to are kept word for word)
12. TODO Natalia, Valentina: confirm these durations [src/components/request/PrivacyNote.tsx, after "Our server keeps only a salted hash of your IP address, in memory, for about 10 minutes, or until the server restarts, to limit repeated sends."]
13. TODO Marlon, Renata: how long Resend keeps message content [PrivacyNote.tsx, after "Resend keeps the content of your message for its own retention period."]
14. TODO Natalia, Valentina: confirm the processor and technical-records sentence [PrivacyNote.tsx, after "Our hosting and email providers may keep their own technical records."]
15. TODO Marlon: retention period; where the email is kept, for how long, who can read the inbox [PrivacyNote.tsx, shown as its own "How long we keep it." paragraph; that paragraph had no other text and is not shown until this is answered]
16. TODO Marlon: legal entity address, data-protection contact, governing law [PrivacyNote.tsx, after "Inspire Business Group LLC."]
17. TODO Marlon, counsel: whether processor countries should be named [PrivacyNote.tsx]
18. TODO Marlon: if a second copy of each request is stored anywhere, the no-database sentence changes [PrivacyNote.tsx; the sentence is "The form has no database and takes no files."]

### Also removed from the code (only visible when the Turnstile key is missing, so not one of the 18)
19. TODO Marlon, Renata: set VITE_TURNSTILE_SITE_KEY for the production build; the form stays hidden (email fallback only) until it is set [src/components/request/RequestForm.tsx]

## 2. New items from this pass (brief v2)

20. **Privacy sentence now out of date, kept as written (brief v2, change 7).** The page no longer loads Google
    Fonts: Geist and Geist Mono are self-hosted from `/assets/`. The privacy note still says, unchanged:
    "This page loads fonts from Google Fonts, so Google receives your IP address when the page loads."
    Marlon (and counsel) to decide the new wording; whoever edits it bumps `PRIVACY_NOTE_VERSION` in
    `shared/serviceRequest.ts`.
21. **Logo.** The "IB" monogram (indigo #4338CA square, white letters) in the favicon, apple-touch icon, nav,
    footer and OG image is temporary until Marlon supplies a logo file (SVG). The accent colour is Camila's
    indigo fallback; once a logo exists, the accent should come from it (DESIGN.md, one variable).
22. **Proof (scorecard checks 3 and 4 fail until this exists).** No client work, client logos, testimonials,
    named results or numbers are on the page, and the hero proof strip is gone. Needed from Marlon, all real and
    with permission: client or partner logos (SVG), one publishable number with date and source, one named
    client result with date, testimonials with name, business and US city/state, case studies.
23. **Founder.** No founder name, photo or bio is on the page (the professionalism brief asks for one).
24. **Pricing signal.** None is shown. The only wording used is the step name "Proposal & fixed quote".
    Marlon to decide whether to say "Projects start at $X".
25. **Process durations.** None are shown because none are sourced. Add only if Marlon supplies them.
26. **Reply-time promise.** "We reply within 1 business day" is not shown (see item 9).
27. **Terms and Privacy pages.** Not created in this pass (brief v2). Privacy stays the in-page note.
28. **Internal request email shows a Qatar timestamp.** `server/serviceRequest/email.ts` prints a "Qatar:"
    line (Asia/Qatar time) in the email sent to the company inbox. It is not on the website and not in
    `dist/`, and server logic was out of scope for this pass (copy and the service list only). Marlon to decide
    whether it should show a US time zone instead.
29. **Service ids changed with the form.** The form's services are now Website, App and Brand identity
    (logo + branding); the shared validator and the server accept `website`, `app`, `brand` (was `website`,
    `logo`, `branding`). Client and server ship together, and all server tests pass, but anything outside this
    repo that posts to `/api/service-request` with the old ids would now get a validation error.
