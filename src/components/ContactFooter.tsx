export default function ContactFooter() {
  return (
    <footer
      id="contact"
      className="relative border-t border-border px-6 py-20 bg-background"
    >
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
          Let's build what's <span className="text-gradient">next</span>.
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">
          Inspire Business Group LLC is a technology and education venture
          studio. Reach out to learn more about Forge, Fluyo, Smart Home
          Certification, or partnership opportunities.
        </p>
        <a
          href="mailto:info@inspirebusinesstechnology.com"
          className="inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          info@inspirebusinesstechnology.com
        </a>
        <div className="mt-20 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} Inspire Business Group LLC. All
            rights reserved.
          </span>
          <span>Forge · Fluyo · Smart Home Certification</span>
        </div>
      </div>
    </footer>
  )
}
