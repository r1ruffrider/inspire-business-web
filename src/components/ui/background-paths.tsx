import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import { RequestCta, SeeLink } from "@/components/ui/actions"

// 36 paths per layer. Durations are stable (no Math.random in render).
const PATH_COUNT = 36

function pathD(i: number, position: number) {
  return `M-${380 - i * 5 * position} -${189 + i * 6}C-${
    380 - i * 5 * position
  } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
    152 - i * 5 * position
  } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
    684 - i * 5 * position
  } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`
}

function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: PATH_COUNT }, (_, i) => ({
    id: i,
    d: pathD(i, position),
    width: 0.5 + i * 0.03,
    // deterministic 20..29 s
    duration: 20 + ((i * 7 + (position > 0 ? 3 : 5)) % 10),
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full text-white/80" viewBox="0 0 696 316" fill="none" aria-hidden="true">
        {paths.map((path) =>
          animate ? (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.1 + path.id * 0.03}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{
                pathLength: 1,
                opacity: [0.3, 0.6, 0.3],
                pathOffset: [0, 1, 0],
              }}
              transition={{
                duration: path.duration,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          ) : (
            // Frozen: off-screen or reduced motion. Same line art, no loop.
            <path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={(0.1 + path.id * 0.03) * 0.45}
            />
          ),
        )}
      </svg>
    </div>
  )
}

const ACCENT_WORD = "Architecture"

/**
 * Mission statement. The line art loops only while on screen and not under
 * reduced motion (then it is a frozen SVG). The per-letter spring runs once,
 * and becomes plain text under reduced motion. The one primary action here is
 * "Request services"; "See what we build" is the quiet secondary.
 */
export function BackgroundPaths({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  // Start animating a little before the section enters the viewport.
  const inView = useInView(sectionRef, { margin: "200px 0px 200px 0px" })
  const animate = !reduced && inView
  const words = title.split(" ")

  return (
    <section ref={sectionRef} id="mission" className="mission">
      <div className="absolute inset-0">
        <FloatingPaths position={1} animate={animate} />
        <FloatingPaths position={-1} animate={animate} />
      </div>

      <div className="relative z-10 wrap text-center">
        <div className="mission__scrim" />
        <div className="max-w-4xl mx-auto">
          {reduced ? (
            <h2 className="mission__h2">
              {words.map((word, wordIndex) => (
                <span key={wordIndex}>
                  {wordIndex > 0 && " "}
                  <span className={word === ACCENT_WORD ? "accent-w" : undefined}>{word}</span>
                </span>
              ))}
            </h2>
          ) : (
            <h2 className="mission__h2" aria-label={title}>
              {words.map((word, wordIndex) => (
                <span key={wordIndex} aria-hidden="true" className="inline-block mr-4 last:mr-0">
                  {word.split("").map((letter, letterIndex) => (
                    <motion.span
                      key={`${wordIndex}-${letterIndex}`}
                      initial={{ y: 60, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{
                        delay: wordIndex * 0.06 + letterIndex * 0.015,
                        type: "spring",
                        stiffness: 150,
                        damping: 25,
                      }}
                      className={`inline-block${word === ACCENT_WORD ? " accent-w" : ""}`}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              ))}
            </h2>
          )}

          {subtitle && (
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
              {subtitle}
            </p>
          )}

          <div className="mission__actions">
            <RequestCta />
            <SeeLink />
          </div>
        </div>
      </div>
    </section>
  )
}
