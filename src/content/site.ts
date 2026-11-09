import type { SiteContent } from "./types"

// Single source for the page copy, the FAQ and (via scripts/prerender.mjs) the
// FAQPage JSON-LD. Sources: brief v2 (owner decisions on card t1038s4046) and
// the facts the site already published. Nothing is invented: no durations,
// prices, numbers, client names or promises about reply times.
export const EMAIL = "info@inspirebusinesstechnology.com"
export const LEGAL_NAME = "Inspire Business Group LLC"

export const NAV_LINKS = [
  { label: "Services", href: "/#services" },
  { label: "Process", href: "/#process" },
  { label: "Products", href: "/#products" },
  { label: "Work", href: "/work" },
  { label: "Team", href: "/team" },
  { label: "FAQ", href: "/#faq" },
] as const

/** Nav and footer links. Drops Team when the roster is empty, so /team is never a dead end. */
export function navLinks(teamCount: number) {
  if (teamCount > 0) return NAV_LINKS
  return NAV_LINKS.filter((link) => link.href !== "/team")
}

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
      line: "A framework for certifying homes by their level of smart-technology integration.",
      url: "https://atomshott.com/",
    },
  ],
  // Working briefs only. Not employment, licenses, degrees, or locations.
  // Photos are used only on /team. Placeholder role/bio strings await approved copy.
  team: [
    {
      name: "Marlon Gibson",
      role: "Founder & CEO",
      initials: "MG",
      image: "/team/marlon-gibson.webp",
    },
    {
      name: "Adriana Solano",
      role: "Chief of Operations",
      initials: "AS",
      bio: "Turns a request into a sequenced plan, assigns owners, and keeps the work moving through launch.",
      image: "/team/adriana-solano.webp",
    },
    {
      name: "Catalina Moreno",
      role: "Software Architect",
      initials: "CM",
      bio: "Designs the system before production code is written, so the build has clear bounds.",
      image: "/team/catalina-moreno.webp",
    },
    {
      name: "Valentina Cruz",
      role: "Coding Engineer",
      initials: "VC",
      bio: "Implements the backend, frontend, and database work the architecture calls for.",
      image: "/team/valentina-cruz.webp",
    },
    {
      name: "Renata Vega",
      role: "Infrastructure / DevOps Engineer",
      initials: "RV",
      bio: "Makes builds, hosting, and launches repeatable.",
      image: "/team/renata-vega.webp",
    },
    {
      name: "Camila Reyes",
      role: "UX Design Engineer",
      initials: "CR",
      bio: "Designs how the product should feel to use, from the first visit through handoff.",
      image: "/team/camila-reyes.webp",
    },
    {
      name: "Daniela Vargas",
      role: "Web Designer",
      initials: "DV",
      bio: "Designs and builds the pages and visual system customers see.",
      image: "/team/daniela-vargas.webp",
    },
    {
      name: "Natalia Ortega",
      role: "Security Engineer",
      initials: "NO",
      bio: "Finds what can be abused before a release ships.",
      image: "/team/natalia-ortega.webp",
    },
    {
      name: "Aria Chen",
      role: "Cybersecurity Engineer",
      initials: "AC",
      bio: "Reviews security posture and hardening.",
      image: "/team/aria-chen.webp",
    },
    {
      name: "Alexandra Chen",
      role: "Cybersecurity Engineer",
      initials: "AC",
      bio: "Assesses risk and guides security controls.",
      image: "/team/alexandra-chen.webp",
    },
    {
      name: "Elena Castillo",
      role: "Quality Auditor",
      initials: "EC",
      bio: "Inspects work before it ships and reports what passed, what failed, and what to fix.",
      image: "/team/elena-castillo.webp",
    },
    {
      name: "Julieta Herrera",
      role: "Privacy & Compliance Auditor",
      initials: "JH",
      bio: "Checks numbers, privacy, and compliance before something goes public.",
      image: "/team/julieta-herrera.webp",
    },
    {
      name: "Isabella Navarro",
      role: "Marketing Engineer",
      initials: "IN",
      bio: "Shapes the offer so a first-time visitor understands it and knows what to do next.",
      image: "/team/isabella-navarro.webp",
    },
    {
      name: "Fernanda Ortiz",
      role: "Social Media Engineer",
      initials: "FO",
      bio: "Turns the story into posts that fit each channel.",
      image: "/team/fernanda-ortiz.webp",
    },
    {
      name: "Gabriela Mendoza",
      role: "Research Engineer",
      initials: "GM",
      bio: "Turns open questions into sourced findings before the team builds.",
      image: "/team/gabriela-mendoza.webp",
    },
    {
      name: "Bianca Morales",
      role: "Administrative Assistant",
      initials: "BM",
      bio: "Keeps scheduling, follow-ups, and project details in order.",
      image: "/team/bianca-morales.webp",
    },
    {
      name: "Marisol Reyes",
      role: "Audio / Video Engineer",
      initials: "MR",
      bio: "Plans and produces product and explainer audio and video.",
      image: "/team/marisol-reyes.webp",
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
