import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initLenis, scrollToSection } from '@/lib/lenis'

initLenis()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A link such as /#request-services: the browser cannot find the target before
// React has rendered, so jump to it once layout has settled and focus its heading.
if (window.location.hash.length > 1) {
  const hash = window.location.hash
  const go = () => requestAnimationFrame(() => scrollToSection(hash, { keyboard: true, updateHash: false }))
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
