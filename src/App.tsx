import { lazy, Suspense } from "react"
import Nav from "@/components/Nav"
import CinematicReveal, { type Line } from "@/components/CinematicReveal"
import FirstScreen from "@/components/FirstScreen"
import { BackgroundPaths } from "@/components/ui/background-paths"
import { RequestCta } from "@/components/ui/actions"
import Services from "@/components/Services"
import ProductsSection from "@/components/ProductsSection"
import CtaBand from "@/components/CtaBand"
import BeliefsSection from "@/components/BeliefsSection"
import RequestServices from "@/components/RequestServices"
import ContactFooter from "@/components/ContactFooter"

// Everything the hero receives is a module-level constant, so an App re-render
// can never restart the hero's effects or re-request a frame. App holds no
// state at all (the form keeps its own state inside its component).
const POSTER = "/frames/morph/frame_0001.jpg"
const framePath = (i: number) => `/frames/morph/frame_${String(i).padStart(4, "0")}.jpg`

// Contiguous windows (they overlap by 0.02), starting after the first-screen
// layer has faded (p 0.04 to 0.14). Text: COPY.md 1.5.
const HERO_LINES: readonly Line[] = [
  { text: "WE BUILD WHAT'S NEXT.", in: 0.12, out: 0.36 },
  { text: "FROM STUDENT TO CERTIFIED.", in: 0.34, out: 0.58 },
  { text: "FROM BEGINNER TO FLUENT.", in: 0.56, out: 0.8 },
  { text: "TELL US WHAT YOU NEED.", in: 0.78, out: 1.0 },
]

// Dev-only break-ui switch: a dynamic import behind import.meta.env.DEV, so neither the
// component nor its stylesheet is in the production module graph.
const DevSwitch = import.meta.env.DEV ? lazy(() => import("@/components/dev/DevSwitch")) : null

const FIRST_SCREEN = <FirstScreen />
const HERO_END = <RequestCta />

function App() {
  return (
    <div className="relative bg-background">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />

      <main id="main" tabIndex={-1}>
        <CinematicReveal
          frameCount={150}
          framePath={framePath}
          poster={POSTER}
          lines={HERO_LINES}
          scrollVh={240}
          holdLast
          overlay={FIRST_SCREEN}
          endSlot={HERO_END}
        />

        <BackgroundPaths
          title="Where Ambition Meets Architecture"
          subtitle="The gap between where people are and where they want to be is a design problem. Better tools, clearer content and smarter systems can solve it."
        />

        <Services />
        <ProductsSection />
        <CtaBand />
        <BeliefsSection />
        <RequestServices />
      </main>

      <ContactFooter />
      {DevSwitch && (
        <Suspense fallback={null}>
          <DevSwitch />
        </Suspense>
      )}
    </div>
  )
}

export default App
