import { useState } from "react"
import {
  ArrowRight,
  FileText,
  Hexagon,
  Lock,
  Network,
  Shield,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react"
import Todo, { SHOW_TODOS } from "@/components/Todo"
import { content } from "@/content"
import type { Product } from "@/content/types"

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  energy: Zap,
  safety: Shield,
  security: Lock,
  comfort: Sun,
  networks: Network,
  documentation: FileText,
}

/** Decorative once the heading names the product (alt text per COPY 5.5). */
function Media({ src, className }: { src: string; className?: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <div className={className}>
      <img
        src={src}
        alt=""
        width={1200}
        height={896}
        loading="lazy"
        decoding="async"
        onError={() => setOk(false)}
      />
    </div>
  )
}

/** Status chip and "Visit" link render only when the real data exists. */
function Availability({ p }: { p: Product }) {
  return (
    <>
      {p.status && (
        <li>
          <span className="k">Status</span>
          <span>
            <span className="status-chip">{p.status}</span>
          </span>
        </li>
      )}
      {p.url && (
        <li>
          <span className="k">Link</span>
          <span>
            <a className="link" href={p.url} rel="noopener">
              Visit {p.name}
              <ArrowRight aria-hidden="true" />
            </a>
          </span>
        </li>
      )}
    </>
  )
}

function Facts({ p }: { p: Product }) {
  // A row needs both a label and a value: no orphaned labels.
  const facts = p.facts.filter((f) => f.k.trim() && f.v.trim())
  const hasAvailability = !!(p.status || p.url)
  if (facts.length === 0 && !hasAvailability) return null
  return (
    <ul className="facts">
      {facts.map((f, i) => (
        <li key={i}>
          <span className="k">{f.k}</span>
          <span>{f.v}</span>
        </li>
      ))}
      <Availability p={p} />
    </ul>
  )
}

function Index({ i, total }: { i: number; total: number }) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    <span className="pf__idx">
      {pad(i + 1)} / {pad(total)}
    </span>
  )
}

function ProductTodos({ p }: { p: Product }) {
  if (!SHOW_TODOS) return null
  const missing = [!p.status && "status", !p.url && "URL"].filter(Boolean).join(" and ")
  return (
    <>
      {missing && (
        <p className="m-0">
          <Todo what={`Marlon: ${p.name} ${missing} (chip and link render only if true)`} />
        </p>
      )}
      {p.name === "Fluyo" && (
        <p className="m-0">
          <Todo what="Marlon: which languages Fluyo teaches" />
        </p>
      )}
    </>
  )
}

/**
 * Products: an editorial sequence, a different rhythm per product (media left,
 * media bleeding right, then a full-width domain panel). Rhythm is derived
 * from the data, so any number of products still alternates.
 */
export default function ProductsSection() {
  const products = content.products
  if (products.length === 0) return null
  let flow = 0
  return (
    <section id="products" className="section products rule anchor" aria-labelledby="products-h">
      <div className="wrap">
        <div className="pf-head">
          <p className="eyebrow">Our products</p>
          <h2 className="h2" id="products-h">
            Platforms built to help people learn, certify and live better.
          </h2>
        </div>

        {products.map((p, i) => {
          const domains = p.domains && p.domains.length > 0 ? p.domains : null
          const isBand = domains !== null
          const variant = isBand ? "c" : flow++ % 2 === 0 ? "a" : "b"
          const text = (
            <div className="pf__txt">
              <Index i={i} total={products.length} />
              {p.eyebrow && <p className="eyebrow">{p.eyebrow}</p>}
              <h3 className="pf__name" translate="no">
                {p.name}
              </h3>
              {p.line && <p className="body">{p.line}</p>}
              <Facts p={p} />
              <ProductTodos p={p} />
            </div>
          )

          if (isBand) {
            return (
              <article className="pf pf--c" key={`${p.name}-${i}`}>
                <div className="domains-band">
                  <Media src={p.image} className="domains-band__img-wrap" />
                  <div className="domains-band__in">
                    {text}
                    <div className="stack gap-3">
                      {p.domainsLabel && <p className="eyebrow">{p.domainsLabel}</p>}
                      <ul className="domains" aria-label={`${p.name}: ${p.domainsLabel ?? "domains"}`}>
                        {domains.map((d, k) => {
                          const Icon = DOMAIN_ICONS[d.toLowerCase()] ?? Hexagon
                          return (
                            <li key={`${d}-${k}`}>
                              <Icon strokeWidth={1.75} aria-hidden="true" />
                              <span>{d}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </article>
            )
          }
          return (
            <article className={`pf pf--${variant}`} key={`${p.name}-${i}`}>
              <Media src={p.image} className="pf__media" />
              {text}
            </article>
          )
        })}
      </div>
    </section>
  )
}
