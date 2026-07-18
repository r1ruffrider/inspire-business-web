import { motion } from "framer-motion"

const PRODUCTS = [
  {
    name: "Forge",
    tagline: "Learning & Testing Platform",
    description:
      "An AI-powered exam prep platform for high-stakes certifications, starting with CISSP — adaptive practice, deep explanations, and structured study paths so professionals pass the first time.",
    image: "/images/forge.jpg",
  },
  {
    name: "Fluyo",
    tagline: "Language Learning Platform",
    description:
      "A modern approach to language acquisition that meets learners where they are and keeps them moving forward through engaging, personalized experiences.",
    image: "/images/fluyo.jpg",
  },
  {
    name: "Smart Home Certification",
    tagline: "Credentialing & Training",
    description:
      "Certification for the rapidly expanding smart home industry, helping technicians and installers establish verified expertise across Energy, Safety, Security, Comfort, Connectivity, and Insurance Readiness.",
    image: "/images/smart-home.jpg",
  },
]

export default function PortfolioSection() {
  return (
    <section id="portfolio" className="relative py-32 px-6 bg-background">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="mb-16 max-w-2xl"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-accent mb-4">
            Our Portfolio
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Three platforms. One belief: the gap is a design problem.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="group rounded-2xl overflow-hidden border border-border bg-card"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-accent mb-2">
                  {p.tagline}
                </p>
                <h3 className="text-xl font-bold mb-3">{p.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
