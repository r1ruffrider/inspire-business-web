// About: statement plus Vision / Mission / Belief as a definition list.
// Words: COPY.md 2.7. No glow orb, no gradient headline, no quotation marks.
const PILLARS = [
  {
    label: "Vision",
    text: "To become a global leader in innovative technology solutions that inspire learning, improve lives, and create smarter, more connected communities.",
  },
  {
    label: "Mission",
    text: "We build intelligent platforms that solve meaningful problems through innovation, education, and technology, helping people and organizations reach their full potential.",
  },
  {
    label: "Belief",
    text: "Technology should be intuitive, accessible, and transformative. Every product we develop is designed to create measurable value.",
  },
]

export default function BeliefsSection() {
  return (
    <section id="about" className="section anchor" aria-labelledby="about-h">
      <div className="wrap beliefs">
        <div className="beliefs__l stack">
          <p className="eyebrow">About</p>
          <h2 className="h2 max-w-[12em]" id="about-h">
            We build systems that move people.
          </h2>
          <p className="max-w-[26em] text-[clamp(1.25rem,2vw,1.625rem)] font-medium leading-[1.35] tracking-[-0.015em] text-foreground-soft">
            From <span className="accent-w">student to certified</span>, from{" "}
            <span className="accent-w">beginner to fluent</span>.
          </p>
        </div>
        <dl className="pillars">
          {PILLARS.map((p) => (
            <div className="pillar" key={p.label}>
              <dt className="eyebrow">{p.label}</dt>
              <dd className="body">{p.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
