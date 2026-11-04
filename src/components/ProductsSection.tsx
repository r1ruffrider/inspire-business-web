import { ArrowUpRight } from "lucide-react"
import { content } from "@/content"

/**
 * Products we build ourselves: proof that we ship software, kept small (well
 * under the height of Services). Calm neutral tiles, name and one line; a link
 * only when a real URL exists.
 */
export default function ProductsSection() {
  const products = content.products
  if (products.length === 0) return null
  return (
    <section id="products" className="section section--compact" aria-labelledby="products-h">
      <div className="wrap products">
        <div className="products__head">
          <p className="mono-label">Our own products</p>
          <h2 className="h2 h2--sm" id="products-h">
            Products we build ourselves.
          </h2>
        </div>
        <ul className="products__list">
          {products.map((p, i) => (
            <li className="product" key={`${p.name}-${i}`}>
              <h3 className="product__name" translate="no">
                {p.url ? (
                  <a href={p.url} rel="noopener">
                    {p.name}
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                ) : (
                  p.name
                )}
              </h3>
              {p.line && <p>{p.line}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
