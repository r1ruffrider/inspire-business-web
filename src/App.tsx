import { lazy, Suspense } from "react"
import Nav from "@/components/Nav"
import Hero from "@/components/Hero"
import Services from "@/components/Services"
import Process from "@/components/Process"
import Mission from "@/components/Mission"
import ProductsSection from "@/components/ProductsSection"
import Team from "@/components/Team"
import Faq from "@/components/Faq"
import RequestServices from "@/components/RequestServices"
import ContactFooter from "@/components/ContactFooter"
import StickyCta from "@/components/StickyCta"

// Dev-only break-ui switch: a dynamic import behind import.meta.env.DEV, so neither the
// component nor its stylesheet is in the production module graph.
const DevSwitch = import.meta.env.DEV ? lazy(() => import("@/components/dev/DevSwitch")) : null

// Page order: Hero, Services, Process, mission pull-quote, Products we build
// ourselves, Meet the team, FAQ, Request services (final call to action +
// form), Footer. No proof section until real proof exists (OWNER-TODO.md).
function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Services />
        <Process />
        <Mission />
        <ProductsSection />
        <Team />
        <Faq />
        <RequestServices />
      </main>
      <ContactFooter />
      <StickyCta />
      {DevSwitch && (
        <Suspense fallback={null}>
          <DevSwitch />
        </Suspense>
      )}
    </>
  )
}

export default App
