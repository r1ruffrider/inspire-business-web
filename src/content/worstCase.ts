import type { SiteContent } from "./types"

// break-ui worst-case dataset. Used only by the dev server with ?data=worst.
// Never reachable in a production build (content/index.ts guards it behind
// import.meta.env.DEV, so it is tree-shaken away).
export function worstCase(): SiteContent {
  const LONG = "Supercalifragilisticexpialidocious".repeat(4)
  return {
    services: [
      { id: "website", name: LONG, line: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6) },
      { id: "app", name: "A", line: "" },
      {
        id: "brand",
        name: "Brand identity, naming, messaging and everything around them for teams of every size",
        line: "موقع إلكتروني وهوية تجارية كاملة",
        also: LONG,
        tiers: [
          { name: LONG, line: "x".repeat(140) },
          { name: "网站设计与品牌标志设计服务", line: "" },
          { name: "Third tier", line: "One more." },
        ],
      },
      { id: "x1", name: "Extra service 4", line: "One line." },
    ],
    process: [
      { name: LONG, line: "Lorem ipsum dolor sit amet. ".repeat(5) },
      { name: "B", line: "" },
      { name: "Proposal & fixed quote and a very long step name", line: "x".repeat(90) },
      { name: "Design", line: "Short." },
      { name: "Build", line: "Short." },
      { name: "Launch & handoff", line: "Short." },
      { name: "Seventh step", line: "Edge." },
    ],
    products: [
      { name: LONG, line: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(4), url: "https://example.com/" + "very-long-path/".repeat(12) },
      { name: "F", line: "" },
      { name: "شهادة المنزل الذكي", line: "تعتمد المنازل حسب مستوى دمج التقنية الذكية." },
      { name: "Fourth product", line: "One line." },
      { name: "Fifth product", line: "One line." },
    ],
    team: [
      {
        name: LONG,
        role: "Infrastructure / DevOps Engineer and a role name that has to wrap twice",
        bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6),
        initials: "LN",
      },
      { name: "A", role: "X", bio: "Short.", initials: "A" },
      {
        name: "Marisol Reyes",
        role: "Audio / Video Engineer",
        bio: "Plans and produces product and explainer video.",
        initials: "MR",
      },
    ],
    faq: [
      { q: LONG + "?", a: "Lorem ipsum dolor sit amet. ".repeat(20) },
      { q: "Short?", a: "Yes." },
      { q: "网站设计与品牌标志设计服务？", a: "موقع إلكتروني وهوية تجارية كاملة" },
    ],
  }
}
