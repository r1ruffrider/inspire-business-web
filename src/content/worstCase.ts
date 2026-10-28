import type { SiteContent } from "./types"

// break-ui worst-case dataset. Used only when running the dev server with
// ?data=worst. Never reachable in a production build: content/index.ts guards
// the import behind import.meta.env.DEV so this module is tree-shaken away.
// A function, so nothing runs at import time and the whole module is dead code
// (and removed) in a production build.
export function worstCase(): SiteContent {
  const LONG = "Supercalifragilisticexpialidocious".repeat(4)
  return {
  services: [
    { id: "a", name: "A" },
    { id: "longword", name: LONG },
    { id: "wrap", name: "Business branding, naming, messaging, identity systems and everything around them for teams of every size" },
    { id: "rtl", name: "موقع إلكتروني وهوية تجارية كاملة" },
    { id: "cjk", name: "网站设计与品牌标志设计服务" },
    { id: "emoji", name: "Website 🚀🚀🚀 and logo ✨" },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `Service number ${i + 7}` })),
  ],
  products: [
    {
      name: LONG,
      eyebrow: "An extremely long eyebrow label that keeps going and going for a very long time to test wrapping",
      line: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10),
      facts: [
        { k: "Starts with a long key", v: "x".repeat(140) },
        { k: "K", v: "" },
        { k: "Method", v: "Adaptive practice, deep explanations, structured study paths, ".repeat(6) },
        ...Array.from({ length: 6 }, (_, i) => ({ k: `Row ${i}`, v: `Value ${i}` })),
      ],
      image: "/images/does-not-exist.jpg",
      status: "Waitlist with an unusually long status label",
      url: "https://example.com/" + "very-long-path/".repeat(12),
    },
    {
      name: "F",
      eyebrow: "",
      line: "",
      facts: [],
      image: "/images/fluyo.jpg",
    },
    {
      name: "شهادة المنزل الذكي",
      eyebrow: "منصة اعتماد",
      line: "تعتمد المنازل حسب مستوى دمج التقنية الذكية.",
      facts: [{ k: "الفئة", v: "أصحاب المنازل والبنائون" }],
      image: "/images/smart-home.jpg",
      domainsLabel: "Domains",
      domains: [
        "E",
        LONG,
        "Safety and everything else that belongs here",
        "安全",
        "الطاقة",
        "Comfort 😀",
        "Seventh",
        "Eighth",
        "Ninth domain with a label long enough to wrap onto a third line in a tile",
        "10",
        "11",
        "12",
        "13",
        "14",
      ],
    },
    // A fourth and fifth product: the layout rhythm must cope with more than three.
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `Extra product ${i + 4}`,
      eyebrow: "Platform",
      line: "One line.",
      facts: [{ k: "For", v: "Everyone" }],
      image: "/images/forge.jpg",
      domains: i === 1 ? [] : undefined,
    })),
  ],
  proof: [
    { kind: "logo", label: "Clients", name: LONG, src: "/images/does-not-exist.svg" },
    { kind: "number", label: "Figure", figure: "1,234,567,890,123", caption: "Questions answered across every certification track we have ever shipped", source: "Source: internal report, 1 January 1970" },
    { kind: "result", label: "Result", client: LONG, result: "Cut onboarding time by an amount that needs a very long sentence to describe in full. ".repeat(3), date: "October 2026" },
    { kind: "number", label: "Figure", figure: "0", caption: "", source: "" },
    { kind: "logo", label: "Partners", name: "A", src: "/favicon.svg" },
    { kind: "result", label: "Result", client: "光", result: "成功", date: "" },
    { kind: "number", label: "Figure", figure: "∞", caption: "Edge", source: "x" },
    { kind: "logo", label: "Clients", name: "Another client", src: "/favicon.svg" },
  ],
  }
}
