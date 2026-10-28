/**
 * Windowed frame loader for the scroll-scrubbed hero. No React, no DOM beyond
 * Image. It never preloads the whole sequence: only frames near the scroll
 * position (plus sparse keyframes after the first scroll intent) are requested,
 * with a hard cap on in-flight requests and an LRU cap on kept frames.
 */
export interface FrameLoader {
  /** Begin loading (call after window load + idle). */
  start(): void
  /** Allow sparse keyframes (call on first scroll intent). */
  armKeyframes(): void
  /** Scroll position changed; re-prioritise around this frame index. */
  setCenter(index: number): void
  /** Exact frame if loaded. */
  get(index: number): HTMLImageElement | null
  /** Closest loaded frame, searching outward. */
  nearest(index: number): HTMLImageElement | null
  /** A frame finished loading. Returns an unsubscribe. */
  onChange(cb: () => void): () => void
  /** Number of image requests started so far (for measurement). */
  readonly requested: number
  dispose(): void
}

export function createFrameLoader(opts: {
  count: number
  path: (index: number) => string // index is 0-based
  ahead?: number
  behind?: number
  maxInFlight?: number
  keyframeStep?: number
  cacheCap?: number
}): FrameLoader {
  const { count, path } = opts
  const ahead = opts.ahead ?? 20
  const behind = opts.behind ?? 6
  const maxInFlight = opts.maxInFlight ?? 4
  const keyframeStep = opts.keyframeStep ?? 10
  const cacheCap = opts.cacheCap ?? 60

  const loaded = new Map<number, HTMLImageElement>() // index -> image
  const used = new Map<number, number>() // index -> last-used tick (LRU)
  const loading = new Map<number, HTMLImageElement>()
  const failed = new Set<number>()
  const listeners = new Set<() => void>()
  let center = 0
  let tick = 0
  let started = false
  let keyframes = false
  let disposed = false
  let requested = 0

  const isKeyframe = (i: number) => i % keyframeStep === 0 || i === count - 1

  const startLoad = (i: number) => {
    const img = new Image()
    img.decoding = "async"
    loading.set(i, img)
    requested++
    img.onload = () => {
      loading.delete(i)
      if (disposed) return
      loaded.set(i, img)
      used.set(i, ++tick)
      evict()
      listeners.forEach((cb) => cb())
      pump()
    }
    img.onerror = () => {
      loading.delete(i)
      failed.add(i)
      pump()
    }
    img.src = path(i)
  }

  const pump = () => {
    if (disposed || !started) return
    while (loading.size < maxInFlight) {
      // 1) the window around the center, closest first (forward slightly favoured)
      let pick = -1
      let best = Infinity
      const lo = Math.max(0, center - behind)
      const hi = Math.min(count - 1, center + ahead)
      for (let i = lo; i <= hi; i++) {
        if (loaded.has(i) || loading.has(i) || failed.has(i)) continue
        const d = i >= center ? i - center : (center - i) * 1.5
        if (d < best) {
          best = d
          pick = i
        }
      }
      // 2) keyframes, only after the first scroll intent, closest to center first
      if (pick < 0 && keyframes) {
        best = Infinity
        for (let i = 0; i < count; i++) {
          if (!isKeyframe(i) || loaded.has(i) || loading.has(i) || failed.has(i)) continue
          const d = Math.abs(i - center)
          if (d < best) {
            best = d
            pick = i
          }
        }
      }
      if (pick < 0) return
      startLoad(pick)
    }
  }

  // Drop the least-recently-used non-keyframe frames beyond the cap.
  const evict = () => {
    let extras = 0
    for (const i of loaded.keys()) if (!isKeyframe(i)) extras++
    if (extras <= cacheCap) return
    const order = [...loaded.keys()]
      .filter((i) => !isKeyframe(i) && (i < center - behind || i > center + ahead))
      .sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))
    for (const i of order) {
      if (extras <= cacheCap) break
      const img = loaded.get(i)
      if (img) img.onload = img.onerror = null
      loaded.delete(i)
      used.delete(i)
      extras--
    }
  }

  return {
    start() {
      if (started || disposed) return
      started = true
      pump()
    },
    armKeyframes() {
      if (keyframes) return
      keyframes = true
      pump()
    },
    setCenter(index) {
      center = Math.max(0, Math.min(count - 1, index))
      pump()
    },
    get(index) {
      const img = loaded.get(index) ?? null
      if (img) used.set(index, ++tick)
      return img
    },
    nearest(index) {
      for (let d = 0; d < count; d++) {
        const a = loaded.get(index - d)
        if (a) {
          used.set(index - d, ++tick)
          return a
        }
        const b = loaded.get(index + d)
        if (b) {
          used.set(index + d, ++tick)
          return b
        }
      }
      return null
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    get requested() {
      return requested
    },
    dispose() {
      disposed = true
      // Stop in-flight loads; keep nothing alive.
      for (const img of loading.values()) {
        img.onload = img.onerror = null
        img.src = ""
      }
      loading.clear()
      loaded.clear()
      used.clear()
      listeners.clear()
    },
  }
}
