import Nav from "@/components/Nav"
import CinematicReveal from "@/components/CinematicReveal"
import { BackgroundPaths } from "@/components/ui/background-paths"
import PortfolioSection from "@/components/PortfolioSection"
import BeliefsSection from "@/components/BeliefsSection"
import ContactFooter from "@/components/ContactFooter"
import { scrollToSection } from "@/lib/lenis"

const HERO_LINES = [
  { text: "WE BUILD WHAT'S NEXT.", in: 0.0, out: 0.26 },
  { text: "FROM STUDENT TO CERTIFIED.", in: 0.3, out: 0.55 },
  { text: "FROM BEGINNER TO FLUENT.", in: 0.6, out: 0.82 },
  { text: "INSPIRE BUSINESS GROUP.", in: 0.86, out: 1.0 },
]

function App() {
  return (
    <div id="top" className="relative bg-background">
      <Nav />

      <CinematicReveal
        frameCount={150}
        framePath={(i) => `/frames/morph/frame_${String(i).padStart(4, "0")}.jpg`}
        lines={HERO_LINES}
        scrollVh={500}
      />

      <BackgroundPaths
        title="Where Ambition Meets Architecture"
        subtitle="The gap between where people are and where they want to be is a design problem — one that better tools, clearer content, and smarter systems can solve."
        ctaLabel="Discover Our Portfolio"
        onCtaClick={() => scrollToSection("#portfolio")}
      />

      <CinematicReveal
        frameCount={150}
        framePath={(i) => `/frames/flythrough/frame_${String(i).padStart(4, "0")}.jpg`}
        lines={[]}
        scrollVh={260}
      />

      <PortfolioSection />
      <BeliefsSection />
      <ContactFooter />
    </div>
  )
}

export default App
