import type { SiteContent } from "./types"

// All words here come from docs/pro-upgrade/COPY.md v3. Nothing is invented.
// Missing facts (product status, URLs, proof) are left out on purpose and
// surface as <Todo> chips only when VITE_SHOW_TODOS=1.
export const DEFAULTS: SiteContent = {
  services: [
    { id: "website", name: "Website" },
    { id: "logo", name: "Logo" },
    { id: "branding", name: "Business branding" },
  ],
  products: [
    {
      name: "Forge",
      eyebrow: "Learning & Testing Platform",
      line: "AI-powered exam prep for high-stakes certifications, starting with CISSP.",
      facts: [
        { k: "Starts with", v: "CISSP exam prep" },
        { k: "Method", v: "Adaptive practice, deep explanations, structured study paths" },
      ],
      image: "/images/forge.jpg",
    },
    {
      name: "Fluyo",
      eyebrow: "Language Learning Platform",
      line: "AI-powered language learning that combines adaptive learning, conversational AI, real-world practice and interactive content.",
      facts: [
        { k: "Method", v: "Adaptive learning" },
        { k: "Practice", v: "Conversational AI and real-world practice" },
        { k: "Content", v: "Interactive" },
      ],
      image: "/images/fluyo.jpg",
    },
    {
      name: "Smart Home Certification",
      eyebrow: "Certification Platform",
      line: "Certifies homes by their level of smart-technology integration.",
      facts: [
        { k: "Certifies", v: "Homes, by their level of smart-technology integration" },
        { k: "For", v: "Homeowners, builders, insurers and real estate professionals" },
      ],
      image: "/images/smart-home.jpg",
      domainsLabel: "Domains",
      domains: ["Energy", "Safety", "Security", "Comfort", "Networks", "Documentation"],
    },
  ],
  // Real proof only. Empty today: the strip is not rendered in production.
  proof: [],
}
