// Shapes of the data-driven content. Everything here is a fact the site already
// published or the owner decided (brief v2). Nothing is invented: no stats,
// prices, durations, testimonials or client names.

export interface ServiceItem {
  /** Matches the request form's service ids (shared/serviceRequest.ts SERVICES). */
  id: string
  name: string
  /** One plain line: what it is, not what it achieves. */
  line: string
  /** Optional named tiers (Brand identity: Logo package, Full brand identity). */
  tiers?: { name: string; line: string }[]
  /** Words that must stay visible for search intent (e.g. "Logo design"). */
  also?: string
}

export interface ProcessStep {
  name: string
  line: string
}

export interface Product {
  name: string
  /** One line about the product. */
  line: string
  /** Real product URL. Omitted until the owner supplies it. */
  url?: string
}

export interface FaqItem {
  q: string
  a: string
}

export interface SiteContent {
  services: ServiceItem[]
  process: ProcessStep[]
  products: Product[]
  faq: FaqItem[]
}
