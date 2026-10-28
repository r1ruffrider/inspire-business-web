import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { createFrameLoader } from "@/lib/frameLoader"
import { getHeroMode, type HeroMode } from "@/lib/heroMode"
import { onReducedMotionChange } from "@/lib/motion"

export type Line = { text: string; in: number; out: number }

type Props = {
  frameCount?: number
  /** 1-based frame path. Pass a module-level function: identity must be stable. */
  framePath: (i: number) => string
  /** Pass a module-level array: identity must be stable. */
  lines?: readonly Line[]
  scrollVh?: number
  bg?: string
  accentLast?: boolean
  /** First-screen layer, rendered above the canvas and below nothing else. */
  overlay?: ReactNode
  /** Scroll progress [from, to] over which the overlay fades out (then goes inert). */
  overlayFade?: readonly [number, number]
  /** Keep the last line at full opacity once its window has been reached. */
  holdLast?: boolean
  /** URL of frame 1: painted as a real <img> so the first screen is never black. */
  poster: string
  /** Shown under the last line (e.g. the repeat of the one action). */
  endSlot?: ReactNode
}

const NO_LINES: readonly Line[] = []
const DEFAULT_FADE = [0.04, 0.14] as const

function useHeroMode(): HeroMode {
  const [mode, setMode] = useState<HeroMode>(getHeroMode)
  useEffect(
    () => onReducedMotionChange((reduced) => setMode(reduced ? "static" : getHeroMode())),
    [],
  )
  return mode
}

function CinematicReveal(props: Props) {
  const mode = useHeroMode()
  return mode === "static" ? <StaticHero {...props} /> : <ScrubHero {...props} />
}

/* ------------------------------------------------------------------ */
/* Scrub mode: pinned stage, poster first, windowed frame loading       */
/* ------------------------------------------------------------------ */
function ScrubHero({
  frameCount = 150,
  framePath,
  lines = NO_LINES,
  scrollVh = 240,
  bg = "#05050c",
  accentLast = true,
  overlay,
  overlayFade = DEFAULT_FADE,
  holdLast = false,
  poster,
  endSlot,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const frameRef = useRef(0)

  // Props that may change identity are read through a ref, so a new identity can
  // never restart the effect below or re-request a frame.
  const live = useRef({ framePath, lines, holdLast, overlayFade })
  useEffect(() => {
    live.current = { framePath, lines, holdLast, overlayFade }
  })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d", { alpha: false })!
    const section = sectionRef.current!

    const loader = createFrameLoader({
      count: frameCount,
      path: (i) => live.current.framePath(i + 1),
    })
    let canvasShown = false

    const draw = (index: number) => {
      const img = loader.nearest(index)
      if (!img?.complete || !img.naturalWidth) return
      const cw = window.innerWidth,
        ch = window.innerHeight
      const ir = img.naturalWidth / img.naturalHeight,
        cr = cw / ch
      let dw, dh, dx, dy
      if (ir > cr) {
        dh = ch
        dw = ch * ir
        dx = (cw - dw) / 2
        dy = 0
      } else {
        dw = cw
        dh = cw / ir
        dx = 0
        dy = (ch - dh) / 2
      }
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cw, ch)
      ctx.drawImage(img, dx, dy, dw, dh)
      if (!canvasShown) {
        canvasShown = true
        canvas.style.visibility = "visible"
      }
      // A substitute frame (nearest loaded) is on screen: show the 2px hairline.
      if (progressRef.current) {
        progressRef.current.style.opacity = loader.get(index) === img ? "0" : "1"
      }
    }

    // Shrinks any line whose natural width would exceed ~92% of the
    // viewport, so long headlines never clip on narrower/tablet widths.
    // The "natural" size is computed from the same clamp(2rem, 7vw, 6rem)
    // formula the headline is styled with, rather than read back off the
    // element itself — reading it back would just return whatever px value
    // a previous fitLines() call left behind, so a line shrunk at a narrow
    // width could never grow back on resize.
    const fitLines = () => {
      const maxWidth = window.innerWidth * 0.92
      const natural = Math.min(96, Math.max(32, window.innerWidth * 0.07))
      lineRefs.current.forEach((el) => {
        if (!el) return
        el.style.fontSize = `${natural}px`
        const width = el.scrollWidth
        if (width > maxWidth) {
          const scale = maxWidth / width
          el.style.fontSize = `${natural * scale}px`
        }
      })
    }

    let lastW = 0,
      lastH = 0
    const resize = () => {
      const w = window.innerWidth,
        h = window.innerHeight
      // Phone URL bars collapse and fire resize with only a small height change:
      // do not reallocate the canvas for that.
      const heightOnly = lastH !== 0 && w === lastW && Math.abs(h - lastH) < 120
      if (!heightOnly) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        lastW = w
        lastH = h
        draw(frameRef.current)
      }
      fitLines()
    }

    let ticking = false
    const render = () => {
      ticking = false
      const { lines: L, holdLast: hold, overlayFade: fade } = live.current
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const p = Math.min(Math.max(-rect.top / scrollable, 0), 1)

      const idx = Math.min(frameCount - 1, Math.floor(p * (frameCount - 1)))
      loader.setCenter(idx)
      if (idx !== frameRef.current) {
        frameRef.current = idx
        draw(idx)
      }
      // Nothing drawn yet while scrolled away from frame 1: poster stands in.
      if (!canvasShown && progressRef.current) {
        progressRef.current.style.opacity = idx === 0 ? "0" : "1"
      }

      // First-screen layer: opacity from scroll progress (never React state).
      const ov = overlayRef.current
      if (ov) {
        const [from, to] = fade
        const oo = p <= from ? 1 : p >= to ? 0 : 1 - (p - from) / (to - from)
        ov.style.opacity = String(oo)
        const hide = oo <= 0.05
        if (ov.inert !== hide) ov.inert = hide
        ov.style.pointerEvents = hide ? "none" : ""
      }

      let beatMax = 0
      lineRefs.current.forEach((el, i) => {
        if (!el) return
        const { in: a, out: b } = L[i]
        const mid = (a + b) / 2,
          half = (b - a) / 2
        let o = 1 - Math.abs(p - mid) / half
        if (hold && i === L.length - 1 && p > mid) o = 1
        o = Math.max(0, Math.min(1, o))
        el.style.opacity = String(o)
        beatMax = Math.max(beatMax, o)
        el.style.transform = `translate(-50%, calc(-50% + ${(1 - o) * 24}px))`
        if (hold && i === L.length - 1 && endRef.current) {
          endRef.current.style.opacity = String(o)
          const hide = o < 0.5
          if (endRef.current.inert !== hide) endRef.current.inert = hide
        }
      })
      // Soft local scrim behind the beat text, following the visible beat's opacity.
      if (scrimRef.current) scrimRef.current.style.opacity = String(beatMax)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(render)
      }
    }

    const unsubscribe = loader.onChange(() => draw(frameRef.current))

    // Nothing is requested before the page has loaded and the browser is idle:
    // the poster is the only frame at first paint.
    let idleHandle = 0
    let usedIdle = false
    const begin = () => {
      const run = () => loader.start()
      if (typeof window.requestIdleCallback === "function") {
        usedIdle = true
        idleHandle = window.requestIdleCallback(run, { timeout: 2000 })
      } else {
        idleHandle = window.setTimeout(run, 200)
      }
    }
    if (document.readyState === "complete") begin()
    else window.addEventListener("load", begin, { once: true })

    // Sparse keyframes only after the first scroll intent.
    const arm = () => {
      loader.armKeyframes()
      removeIntent()
    }
    const intentEvents = ["wheel", "touchmove", "keydown", "scroll"] as const
    const removeIntent = () =>
      intentEvents.forEach((ev) => window.removeEventListener(ev, arm))
    intentEvents.forEach((ev) => window.addEventListener(ev, arm, { passive: true }))

    resize()
    // Run again after fonts/layout settle, since scrollWidth on first paint
    // can be measured before web fonts finish swapping in.
    requestAnimationFrame(fitLines)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", resize)
      window.removeEventListener("load", begin)
      removeIntent()
      if (usedIdle) window.cancelIdleCallback(idleHandle)
      else window.clearTimeout(idleHandle)
      unsubscribe()
      loader.dispose()
    }
  }, [frameCount, bg])

  return (
    <section
      id="top"
      ref={sectionRef}
      aria-labelledby="h1"
      style={{ position: "relative", height: `${scrollVh}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100svh",
          overflow: "hidden",
          background: bg,
        }}
      >
        <img
          className="hero__poster"
          src={poster}
          width={1600}
          height={900}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            visibility: "hidden",
          }}
        />
        {overlay && (
          <div className="hero__layer" ref={overlayRef}>
            {overlay}
          </div>
        )}
        {lines.length > 0 && <div className="beat-scrim" ref={scrimRef} aria-hidden="true" />}
        {lines.map((l, i) => {
          const isAccent = accentLast && i === lines.length - 1
          return (
            <p
              key={i}
              aria-hidden="true"
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              className={isAccent ? "beat beat--accent" : "beat"}
            >
              {l.text}
            </p>
          )
        })}
        {endSlot && (
          <div className="beat-end" ref={endRef}>
            {endSlot}
          </div>
        )}
        <div className="hero-progress" ref={progressRef} aria-hidden="true" />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Static mode: reduced motion, Save-Data, 2g/3g. Complete alternative.  */
/* No pin, no canvas, no fitLines, no frame loading, never black.        */
/* ------------------------------------------------------------------ */
function StaticHero({ lines = NO_LINES, overlay, poster, endSlot }: Props) {
  return (
    <>
      <section id="top" aria-labelledby="h1" className="hero">
        <img
          className="hero__poster"
          src={poster}
          width={1600}
          height={900}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
        <div className="hero__layer hero__layer--flow">{overlay}</div>
      </section>
      {lines.length > 0 && (
        <div className="beats-static">
          <img className="beats-static__poster" src={poster} alt="" width={1600} height={900} loading="lazy" />
          <div className="beats-static__scrim" />
          <div className="wrap">
            <ul className="beats-static__list">
              {lines.map((l, i) => (
                <li key={i}>
                  <span className="idx" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="t">{l.text}</p>
                </li>
              ))}
            </ul>
            {endSlot}
          </div>
        </div>
      )}
    </>
  )
}

export default memo(CinematicReveal)
