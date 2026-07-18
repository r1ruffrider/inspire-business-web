import { motion } from "framer-motion"

const PILLARS = [
  {
    label: "Vision",
    text: "To become a global leader in innovative technology solutions that inspire learning, improve lives, and create smarter, more connected communities.",
  },
  {
    label: "Mission",
    text: "We build intelligent platforms that solve meaningful problems through innovation, education, and technology — helping people and organizations reach their full potential.",
  },
  {
    label: "Belief",
    text: "Technology should be intuitive, accessible, and transformative. Every product we build is designed to create measurable value and prepare our customers for what's next.",
  },
]

export default function BeliefsSection() {
  return (
    <section id="about" className="relative py-32 px-6 overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[36rem] w-[36rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }}
      />
      <div className="container mx-auto max-w-5xl relative z-10">
        <motion.blockquote
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
          className="text-2xl md:text-4xl font-semibold leading-snug text-center mb-24 text-gradient"
        >
          "We build systems that move people — from student to certified, from
          beginner to fluent, from contractor to credentialed expert."
        </motion.blockquote>

        <div className="grid md:grid-cols-3 gap-10">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
            >
              <p className="text-sm uppercase tracking-[0.2em] text-accent mb-3">
                {p.label}
              </p>
              <p className="text-muted-foreground leading-relaxed">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
