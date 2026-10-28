// Shapes of the data-driven content. Everything optional here is rendered only
// when it exists: no empty chips, links or frames.

export interface ServiceItem {
  /** Matches the request form's service ids. */
  id: string
  name: string
}

export interface Fact {
  k: string
  v: string
}

export interface Product {
  name: string
  /** Eyebrow, e.g. "Learning & Testing Platform". */
  eyebrow: string
  /** One line about the product. */
  line: string
  facts: Fact[]
  image: string
  /** True status only (live, beta, waitlist, planned). Omitted until Marlon supplies it. */
  status?: string
  /** Real product URL. Omitted until Marlon supplies it. */
  url?: string
  /** Six-domain diagram (Smart Home Certification). */
  domains?: string[]
  /** Label above the domain tiles. */
  domainsLabel?: string
}

export type ProofItem =
  | { kind: "logo"; label: string; name: string; src: string }
  | { kind: "number"; label: string; figure: string; caption: string; source: string }
  | { kind: "result"; label: string; client: string; result: string; date: string }

export interface SiteContent {
  services: ServiceItem[]
  products: Product[]
  proof: ProofItem[]
}
