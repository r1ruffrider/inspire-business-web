import { lazy, Suspense, useEffect, type ReactNode } from "react"
import Nav from "@/components/Nav"
import Hero from "@/components/Hero"
import Services from "@/components/Services"
import Process from "@/components/Process"
import Mission from "@/components/Mission"
import ProductsSection from "@/components/ProductsSection"
import Team from "@/components/Team"
import Work from "@/components/Work"
import Faq from "@/components/Faq"
import RequestServices from "@/components/RequestServices"
import ContactFooter from "@/components/ContactFooter"
import StickyCta from "@/components/StickyCta"
import { content } from "@/content"
import { detectPage, type PageId } from "@/lib/page"

// Dev-only break-ui switch: a dynamic import behind import.meta.env.DEV, so neither the
// component nor its stylesheet is in the production module graph.
const DevSwitch = import.meta.env.DEV ? lazy(() => import("@/components/dev/DevSwitch")) : null

function Chrome({ page, children }: { page: PageId; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav page={page} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <ContactFooter page={page} />
      <StickyCta page={page} />
      {DevSwitch && (
        <Suspense fallback={null}>
          <DevSwitch />
        </Suspense>
      )}
    </>
  )
}

// Homepage order: Hero, Services, Process, mission pull-quote, Products we build
// ourselves, FAQ, Request services (final call to action + form), Footer.
// Meet the team is /team, not a homepage section. No proof section until real
// proof exists (OWNER-TODO.md).
function Home() {
  return (
    <Chrome page="home">
      <Hero />
      <Services />
      <Process />
      <Mission />
      <ProductsSection />
      <Faq />
      <RequestServices />
    </Chrome>
  )
}

function TeamPage() {
  return (
    <Chrome page="team">
      <Team />
    </Chrome>
  )
}

function WorkPage() {
  return (
    <Chrome page="work">
      <Work />
    </Chrome>
  )
}

function SendHome() {
  useEffect(() => {
    window.location.replace("/")
  }, [])
  return null
}

export default function App({ page }: { page?: PageId }) {
  const route = page ?? detectPage()
  if (route === "work") return <WorkPage />
  if (route === "team" && content.team.length === 0) return <SendHome />
  return route === "team" ? <TeamPage /> : <Home />
}
