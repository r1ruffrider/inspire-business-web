import { useEffect, useRef } from "react"

type Line = { text: string; in: number; out: number }

export default function CinematicReveal({
  frameCount = 150,
  framePath = (i: number) => `/frames/frame_${String(i).padStart(4, "0")}.jpg`,
  lines = [],
  scrollVh = 500,
  bg = "#05050c",
  accentLast = true,
}: {
  frameCount?: number
  framePath?: (i: number) => string
  lines?: Line[]
  scrollVh?: number
  bg?: string
  accentLast?: boolean
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lineRefs = useRef<(HTMLHeadingElement | null)[]>([])
  const imagesRef = useRef<HTMLImageElement[]>([])
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d", { alpha: false })!
    const section = sectionRef.current!

    const images: HTMLImageElement[] = []
    for (let i = 0; i < frameCount; i++) {
      const img = new Image()
      img.src = framePath(i + 1)
      images[i] = img
    }
    imagesRef.current = images

    const draw = (index: number) => {
      const img = images[index]
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

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(frameRef.current)
      fitLines()
    }

    let ticking = false
    const render = () => {
      ticking = false
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const p = Math.min(Math.max(-rect.top / scrollable, 0), 1)

      const idx = Math.min(frameCount - 1, Math.floor(p * (frameCount - 1)))
      if (idx !== frameRef.current) {
        frameRef.current = idx
        draw(idx)
      }

      lineRefs.current.forEach((el, i) => {
        if (!el) return
        const { in: a, out: b } = lines[i]
        const mid = (a + b) / 2,
          half = (b - a) / 2
        let o = 1 - Math.abs(p - mid) / half
        o = Math.max(0, Math.min(1, o))
        el.style.opacity = String(o)
        el.style.transform = `translate(-50%, calc(-50% + ${(1 - o) * 24}px))`
      })
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(render)
      }
    }

    if (images[0]) images[0].onload = () => draw(0)
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
    }
  }, [frameCount, framePath, lines, bg])

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", height: `${scrollVh}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: bg,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {lines.map((l, i) => {
          const isAccent = accentLast && i === lines.length - 1
          return (
            <h1
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                opacity: 0,
                fontWeight: 900,
                fontSize: "clamp(2rem, 7vw, 6rem)",
                letterSpacing: "-0.02em",
                textAlign: "center",
                whiteSpace: "nowrap",
                color: isAccent ? "#8b5cf6" : "#f4f6fb",
                textShadow: isAccent
                  ? // dark outline for contrast against bright footage,
                    // layered under the original violet glow
                    "-1px -1px 0 rgba(0,0,0,0.65), 1px -1px 0 rgba(0,0,0,0.65), -1px 1px 0 rgba(0,0,0,0.65), 1px 1px 0 rgba(0,0,0,0.65), 0 4px 24px rgba(0,0,0,0.55), 0 0 60px rgba(139,92,246,0.5)"
                  : "0 0 40px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            >
              {l.text}
            </h1>
          )
        })}
      </div>
    </section>
  )
}
