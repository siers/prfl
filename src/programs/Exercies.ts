// Generated exercises: the ones whose logic is too long to live inside a `[...]` in
// a `.rndl` line. A line calls one of these and interpolates what comes back.
//
// Everything here is exported through RandomizeLangUtils, which RandomizeLang splices
// into the DSL scope wholesale (`import * as Utils`), so a new export is callable from
// a `.rndl` line as soon as it is re-exported there.
import { DIVISIONS } from '../lib/SheetNotation'

// One 4/4 bar of sixteenths, as on/off slots. 16 of them, because DIVISIONS is per
// quarter and a bar is four of those.
export const SLOTS = DIVISIONS * 4

// Notatable durations, in sixteenths: LilyPond denominator plus dots. These are the
// only lengths a single notehead can spell — 5, 9, 10, 11, 13 and 15 are missing, which
// is what ties are for.
const durations: Record<number, string> = {
  1: '16', 2: '8', 3: '8.', 4: '4', 6: '4.', 7: '4..', 8: '2', 12: '2.', 14: '2..', 16: '1',
}

// A run of held sixteenths, cut into pieces that can each be written as one note.
//
// Two constraints, and the beat one is why this is not just "take the biggest symbol
// that fits". A note may only cross a beat line when it starts on a beat and fills whole
// beats — otherwise the bar stops reading as 4/4, which is the whole point of engraving
// a rhythm exercise. Within a beat, anything the table can spell is allowed.
export function splitRun(start: number, length: number): number[] {
  const pieces: number[] = []
  let at = start
  let left = length

  while (left > 0) {
    // On a beat with a beat's worth left: take the longest run of WHOLE beats that is
    // still one symbol. Otherwise: stop at the next beat line.
    let take = at % 4 == 0 && left >= 4
      ? [16, 12, 8, 4].find(c => c <= left && (at + c) % 4 == 0) ?? 4
      : Math.min(left, 4 - (at % 4))

    // The beat-aligned branch picks from the table already; this is for the other one,
    // where the distance to the beat line can be a length no symbol spells.
    while (!durations[take] && take > 0) take--

    pieces.push(take)
    at += take
    left -= take
  }

  return pieces
}

type Run = { on: boolean, length: number }

// Adjacent equal slots collapse into one run — this is the "bind" step: neighbouring
// on-slots become one held note rather than repeated sixteenths.
export function bindRuns(slots: number[]): Run[] {
  return slots.reduce<Run[]>((runs, slot) => {
    const last = runs[runs.length - 1]
    if (last && last.on == !!slot) last.length++
    else runs.push({ on: !!slot, length: 1 })
    return runs
  }, [])
}

// The bound slots as sheet notation. A run that needs several symbols is written as
// tied pieces, so it still sounds and engraves as one held note.
export function renderSlots(slots: number[], pitch: string = 'c'): string {
  let at = 0

  return bindRuns(slots).flatMap(run => {
    const pieces = splitRun(at, run.length)
    at += run.length

    return pieces.map((piece, i) =>
      // The tie goes on every piece but the last: `~` binds a note to the one after it.
      // Rests are never tied — nothing is held through a rest.
      (run.on ? pitch : 'r') + durations[piece] + (run.on && i < pieces.length - 1 ? '~' : ''))
  }).join(' ')
}

// A bar of sixteenths, each on with probability `onIn / (onIn + offIn)`.
export function randomSlots(onIn: number = 3, offIn: number = 1): number[] {
  return Array.from({ length: SLOTS }, () => Math.random() < onIn / (onIn + offIn) ? 1 : 0)
}

// Every rotation of `slots`, starting with the phrase itself.
export function rotations(slots: number[]): number[][] {
  return slots.map((_, k) => [...slots.slice(k), ...slots.slice(0, k)])
}

// The exercise: one random phrase and all 16 of its rotations, each as a grid string
// and as sheet notation.
//
// Rotating a rhythm keeps its intervals but moves every one of them against the beat,
// so the same material has to be re-felt from a different downbeat each time — which is
// the point of practising it.
export function rotationExercise(pitch: string = 'c', onIn: number = 3, offIn: number = 1) {
  return rotations(randomSlots(onIn, offIn))
    .map(slots => ({ grid: slots.join(''), sheet: renderSlots(slots, pitch) }))
}
