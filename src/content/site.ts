import type { SiteContent } from "./types"

// Single source for the page copy, the FAQ and (via scripts/prerender.mjs) the
// FAQPage JSON-LD. Sources: brief v2 (owner decisions on card t1038s4046) and
// the facts the site already published. Nothing is invented: no durations,
// prices, numbers, client names or promises about reply times.
export const EMAIL = "info@inspirebusinesstechnology.com"
export const LEGAL_NAME = "Inspire Business Group LLC"

export const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Products", href: "#products" },
  { label: "FAQ", href: "#faq" },
] as const

export const DEFAULTS: SiteContent = {
  services: [
    {
      id: "website",
      name: "Web design",
      line: "A website for your business, designed and built for you.",
    },
    {
      id: "app",
      name: "App development",
      line: "An app for your business or your customers, designed and built for you.",
    },
    {
      id: "brand",
      name: "Brand identity",
      line: "The logo and look your customers know you by.",
      also: "Logo design",
      tiers: [
        { name: "Logo package", line: "Logo design on its own." },
        { name: "Full brand identity", line: "Your logo plus the rest of your brand." },
      ],
    },
  ],
  process: [
    { name: "Free consultation", line: "We talk through what you need." },
    { name: "Proposal & fixed quote", line: "You get a written proposal with a fixed quote." },
    { name: "Design", line: "We design it with you." },
    { name: "Build", line: "We build what you approved." },
    { name: "Launch & handoff", line: "We launch it and hand it over to you." },
  ],
  products: [
    {
      name: "Forge",
      line: "AI-powered exam prep for high-stakes certifications, starting with CISSP.",
    },
    {
      name: "Fluyo",
      line: "AI-powered language learning with conversational AI and real-world practice.",
    },
    {
      name: "Smart Home Certification",
      line: "Certifies homes by their level of smart-technology integration.",
    },
  ],
  faq: [
    {
      q: "What does Inspire Business Group do?",
      a: "We design and build websites and apps, and we create brand identities, from a logo package to a full brand identity.",
    },
    {
      q: "Who do you work with?",
      a: "Small businesses across the US.",
    },
    {
      q: "How does a project start?",
      a: "Send a request with the form on this page, or email info@inspirebusinesstechnology.com. Every project starts with a free consultation, followed by a proposal with a fixed quote, then design, build, and launch and handoff.",
    },
    {
      q: "Where do you work?",
      a: "We work remotely with small businesses anywhere in the US.",
    },
    {
      q: "Can I ask for more than one service?",
      a: "Yes. In the request form you can choose a website, an app, brand identity, or any mix.",
    },
  ],
}
