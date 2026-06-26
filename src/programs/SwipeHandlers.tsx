import { CSSProperties, PointerEventHandler } from "react"

const MAX_DIST = 350
const MIN_DIST = 8

export type SwipeDirection = "N" | "S" | "E" | "W"

function directionOf(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W"
  return dy > 0 ? "S" : "N" // screen y grows downward
}

type Point = { x: number; y: number }

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
 * (press → release) fires `onWipe` with the dominant cardinal direction.
 * Drags longer than `maxDist` are aborted; shorter than `minDist` are taps.
 *
 *   const bind = useWipe((dir) => console.log(dir))
 *   <p {...bind}>text</p>
 *
 * Spreading sets `style` wholesale — merge after the spread if the element
 * needs its own: `<p {...bind} style={{ ...bind.style, color: "red" }}>`.
 */
export function useWipe(
  onWipe: (dir: SwipeDirection, e: PointerEvent) => void,
  { maxDist = MAX_DIST, minDist = MIN_DIST }: UseWipeOptions = {},
): WipeHandlers {
  // The whole gesture lives in this one handler's closure — start point and
  // capture flag are plain locals, scoped to a single press→release. Nothing
  // needs to survive a rerender, so no ref is required.
  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    const el = e.currentTarget
    const pointerId = e.pointerId
    const from: Point = { x: e.clientX, y: e.clientY }
    let captured = false

    function onMove(ev: PointerEvent) {
      if (captured) return
      const dist = Math.hypot(ev.clientX - from.x, ev.clientY - from.y)
      if (dist < minDist) return
      // Real drag now: capture (suppresses the synthetic click) and own it.
      captured = true
      el.setPointerCapture(pointerId)
    }

    function onUp(ev: PointerEvent) {
      cleanup()
      // Never dragged → a tap. Native click flows through untouched.
      if (!captured) return
      const dx = ev.clientX - from.x
      const dy = ev.clientY - from.y
      if (Math.hypot(dx, dy) > maxDist) return // too far — abort
      onWipe(directionOf(dx, dy), ev)
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
