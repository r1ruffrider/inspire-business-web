import { useState } from "react"
import Todo, { SHOW_TODOS } from "@/components/Todo"
import { content } from "@/content"
import type { ProofItem } from "@/content/types"

// A logo that fails to load falls back to the client name as text.
function LogoSlot({ item }: { item: Extract<ProofItem, { kind: "logo" }> }) {
  const [ok, setOk] = useState(true)
  return (
    <div className="slot">
      <span className="k">{item.label}</span>
      {ok ? (
        <img
          src={item.src}
          alt={`${item.name} logo`}
          height={32}
          loading="lazy"
          onError={() => setOk(false)}
        />
      ) : (
        <span className="v">{item.name}</span>
      )}
    </div>
  )
}

function Slot({ item }: { item: ProofItem }) {
  if (item.kind === "logo") return <LogoSlot item={item} />
  if (item.kind === "number") {
    return (
      <div className="slot">
        <span className="k">{item.label}</span>
        <span className="big">{item.figure}</span>
        {item.caption && <span className="cap">{item.caption}</span>}
        {item.source && <span className="cap">{item.source}</span>}
      </div>
    )
  }
  return (
    <div className="slot">
      <span className="k">{item.label}</span>
      <span className="v">{item.client}</span>
      <span className="cap">{item.result}</span>
      {item.date && <span className="cap">{item.date}</span>}
    </div>
  )
}

/**
 * Proof near the top. A designed slot that renders ONLY when real proof data
 * exists in src/content/site.ts. Never an empty frame, never placeholder text
 * on the live site. With VITE_SHOW_TODOS=1 and no data it shows three dashed
 * TODO slots so the layout can be reviewed.
 */
export default function ProofStrip() {
  // Three slots, as designed: more would push the headline off a phone screen.
  const items = content.proof.slice(0, 3)
  if (items.length === 0) {
    if (!SHOW_TODOS) return null
    return (
      <div className="proof" role="group" aria-label="Proof (placeholder)">
        <p className="eyebrow proof__label">Proof</p>
        <div className="proof__grid">
          <div className="slot slot--todo">
            <Todo what="Marlon: client or partner logos (SVG, with permission)" />
          </div>
          <div className="slot slot--todo">
            <Todo what="Marlon: one publishable number, with date and source" />
          </div>
          <div className="slot slot--todo">
            <Todo what="Marlon: one named client result, with date" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="proof" role="group" aria-label="Proof">
      <p className="eyebrow proof__label">Proof</p>
      <div className="proof__grid">
        {items.map((item, i) => (
          <Slot key={i} item={item} />
        ))}
      </div>
    </div>
  )
}
