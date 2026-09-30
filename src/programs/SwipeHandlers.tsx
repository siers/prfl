import { CSSProperties, PointerEventHandler } from "react"
import { burstEmojiNotif } from "./Burst.tsx"

const MAX_DIST = 350
const MIN_DIST = 30

export type SwipeDirection = "N" | "S" | "E" | "W"

function directionOf(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W"
  return dy > 0 ? "S" : "N" // screen y grows downward
}

type Point = { x: number; y: number }

export type WipeStep = { icon?: string; run: (e: PointerEvent) => void }
export type WipeSteps = WipeStep | [near: WipeStep, far: WipeStep]
export type WipeMap = Partial<Record<SwipeDirection, WipeSteps>>

export type WipeHandlers = {
  style: CSSProperties
  onPointerDown: PointerEventHandler<HTMLElement>
}

export type UseWipeOptions = {
  maxDist?: number
  minDist?: number
}

/**
 * Returns a props object to spread onto an element. A short directional drag
 * (press → release) runs the step mapped to its dominant cardinal direction.
 * A direction maps to one step spanning `minDist`..`maxDist`, or to a
 * `[near, far]` pair splitting that range at its midpoint. Drags past
 * `maxDist` are aborted mid-drag (with a ❌ burst); shorter than `minDist`
 * are taps. A step's icon bursts as soon as the drag would register it.
 *
 *   const bind = useWipe({ E: { icon: "✅", run: review }, W: [near, far] })
 *   <p {...bind}>text</p>
 *
 * Spreading sets `style` wholesale — merge after the spread if the element
 * needs its own: `<p {...bind} style={{ ...bind.style, color: "red" }}>`.
 */
export function useWipe(
  steps: WipeMap,
  { maxDist = MAX_DIST, minDist = MIN_DIST }: UseWipeOptions = {},
): WipeHandlers {
  const splitDist = (minDist + maxDist) / 2

  function stepAt(dx: number, dy: number): WipeStep | undefined {
    const s = steps[directionOf(dx, dy)]
    if (!Array.isArray(s)) return s
    return Math.hypot(dx, dy) < splitDist ? s[0] : s[1]
  }

  // The whole gesture lives in this one handler's closure — start point and
  // capture flag are plain locals, scoped to a single press→release. Nothing
  // needs to survive a rerender, so no ref is required.
  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    const el = e.currentTarget
    const pointerId = e.pointerId
    const from: Point = { x: e.clientX, y: e.clientY }
    let captured = false
    let pending: WipeStep | undefined // step whose icon last burst

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - from.x
      const dy = ev.clientY - from.y
      const dist = Math.hypot(dx, dy)
      if (dist < minDist) return
      if (!captured) {
        // Real drag now: capture (suppresses the synthetic click) and own it.
        captured = true
        el.setPointerCapture(pointerId)
      }
      if (dist > maxDist) {
        // Too far — abort now, mid-drag, so the ❌ shows while still swiping.
        cleanup()
        burstEmojiNotif("❌")
        return
      }
      const step = stepAt(dx, dy)
      if (step === pending) return
      pending = step
      if (step?.icon) burstEmojiNotif(step.icon)
    }

    function onUp(ev: PointerEvent) {
      cleanup()
      // Never dragged → a tap. Native click flows through untouched.
      if (!captured) return
      stepAt(ev.clientX - from.x, ev.clientY - from.y)?.run(ev)
    }

    function cleanup(_ev?: PointerEvent) {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", cleanup)
    }

    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", cleanup)
  }

  return {
    style: { touchAction: "none", userSelect: "none" },
    onPointerDown,
  }
}
