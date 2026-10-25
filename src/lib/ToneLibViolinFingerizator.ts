import _ from 'lodash'
import { directRange } from './Array'
import { inventoryFromString, Stock, stockFromInventory } from './Combinatorics'
import { balanceOrder, ChoiceStats, recordChoice } from './Random'
import { equalLetterOctave, Note, rename, semi, stepN } from './ToneLib'
import { columnOfLetter, ModeShiftGen, positionOf, StringName, stringIndex, stringNames, strings3 } from './ToneLibViolin'

// Fingerings for the ModeShiftGens of `modeShiftsGen`: the scale walked note by
// note, with the string, position and finger of each note and the shifts taken.

export type PlannedShift = {
  size: number,
  finger: number, // the finger the shift starts from
  string: StringName,
}

// x y w z: shift starting from finger 1 2 3 4
const shiftFingerLetters = 'xywz'

// '2yG-3wD' → [{ size: 2, finger: 2, string: 'G' }, { size: 3, finger: 3, string: 'D' }].
// Without a letter the shift starts from the first finger it can: a shift of n from n.
export function parseShiftPlan(plan: string): PlannedShift[] {
  return [...plan.matchAll(/(\d)([xywz]?)([GDAE])/g)].map(([, size, letter, string]) => ({
    size: Number(size),
    finger: letter ? shiftFingerLetters.indexOf(letter) + 1 : Number(size),
    string: stringNames['GDAE'.indexOf(string)],
  }))
}

// A shift of 4 can only start from 4, so it goes without a letter: '2yG-4D'.
export function renderShiftPlan(shifts: PlannedShift[]): string {
  return shifts.map(sh => `${sh.size}${sh.size == 4 ? '' : shiftFingerLetters[sh.finger - 1]}${sh.string}`).join('-')
}

export type FingeringStep = {
  note: Note,
  string: StringName,
  position: number,
  finger: number,
  shift: number, // the shift size taken to reach this note, 0 when none
}

export type Fingering = {
  steps: FingeringStep[],
  plan: string,
  stats: ChoiceStats<number, number>,
}

// The notes from the root up to the end note, a diatonic step apart, in the key.
function modeNotes(ms: ModeShiftGen): Note[] {
  const notes = [ms.root]
  while (!equalLetterOctave(notes.at(-1)!, ms.endNote)) {
    const stepped = stepN(notes.at(-1)!, 1)
    notes.push(equalLetterOctave(stepped, ms.endNote) ? ms.endNote : rename(stepped, ms.key))
  }
  return notes
}

// Where a walk's shifts come from: which sizes the next shift on a string may
// take, and whether one is due there (so the walk may not move on without it).
type ShiftSource = {
  sizes: (string: StringName, left: number) => number[],
  take: (size: number) => ShiftSource,
  due: (string: StringName) => boolean,
  stuck: (string: StringName) => boolean, // a due shift was left behind on a lower string
  done: boolean,
}

// Sizes from the stock, on the strings in `distrib`, in any amount.
function inventorySource(stock: Stock[], strings: StringName[]): ShiftSource {
  return {
    sizes: (string, left) => strings.includes(string) ? _.uniq(stock.filter(st => st.count > 0 && st.value <= left).map(st => st.value)) : [],
    take: size => inventorySource(stock.map(st => st.value == size ? { ...st, count: st.count - 1 } : st), strings),
    due: () => false,
    stuck: () => false,
    done: true,
  }
}

// Exactly the sketch's shifts, in its order, each on its string.
function sketchSource(sketch: PlannedShift[]): ShiftSource {
  const [next, ...rest] = sketch
  return {
    sizes: string => next?.string == string ? [next.size] : [],
    take: () => sketchSource(rest),
    due: string => next?.string == string,
    stuck: string => !!next && stringIndex(next.string) < stringIndex(string),
    done: !next,
  }
}

type WalkState = {
  steps: FingeringStep[],
  shifts: PlannedShift[],
  source: ShiftSource,
  stats: ChoiceStats<number, number>,
  target?: { size: number, finger: number }, // the shift chosen on this string, not yet taken
  closed: boolean, // no more shifts on this string
}

// Walks the scale of a ModeShiftGen note by note up from the root, searching
// for a fingering and the shift plan it took ('2yG-3wD'). Fingers go up within
// the position; a shift of n from finger f (n <= f) lands on f + 1 - n; out of
// fingers it crosses to the next string, whose open note the crossed-to note
// may not be below. The shifts come from `source` and add up to the diatonic
// shifts, so the walk ends on the end finger. Each shift's starting finger is
// balanced by its size through `stats`; the search backtracks, so only
// playable plans come out. Null when there is none.
function searchFingering(ms: ModeShiftGen, source: ShiftSource, stats: ChoiceStats<number, number>): Fingering | null {
  const notes = modeNotes(ms)
  const used = (shifts: PlannedShift[]) => _.sumBy(shifts, sh => sh.size)

  const start = strings3[stringIndex(ms.startString)]
  const first: FingeringStep = {
    note: ms.root,
    string: ms.startString,
    position: positionOf(columnOfLetter(start.positions, ms.root), ms.start),
    finger: ms.start,
    shift: 0,
  }

  const go = (state: WalkState): Fingering | null => {
    const prev = state.steps.at(-1)!
    const note = notes[state.steps.length]
    if (state.source.stuck(prev.string)) return null
    if (!note) {
      const done = prev.finger == ms.end && used(state.shifts) == ms.diatonicShifts && state.source.done
      return done ? { steps: state.steps, plan: renderShiftPlan(state.shifts), stats: state.stats } : null
    }

    const { target } = state
    if (target && prev.finger == target.finger) {
      const step = { ...prev, note, position: prev.position + target.size, finger: prev.finger + 1 - target.size, shift: target.size }
      const shift = { ...target, string: prev.string }
      return go({ ...state, steps: [...state.steps, step], shifts: [...state.shifts, shift], target: undefined })
    }
    if (target) return go({ ...state, steps: [...state.steps, { ...prev, note, finger: prev.finger + 1, shift: 0 }] })

    // choose the next shift on this string, or none
    const left = ms.diatonicShifts - used(state.shifts)
    const choices = state.closed ? [] : state.source.sizes(prev.string, left).flatMap(size =>
      balanceOrder(state.stats, size, directRange(Math.max(size, prev.finger), 4)).map(finger => ({ size, finger }))
    )
    for (const choice of choices) {
      const found = go({ ...state, source: state.source.take(choice.size), stats: recordChoice(state.stats, choice.size, choice.finger), target: choice })
      if (found) return found
    }
    if (state.source.due(prev.string)) return null

    if (prev.finger < 4) return go({ ...state, steps: [...state.steps, { ...prev, note, finger: prev.finger + 1, shift: 0 }], closed: true })

    const next = strings3[stringIndex(prev.string) + 1]
    if (!next || semi(note) < semi(next.base)) return null
    const finger = columnOfLetter(next.positions, note) - prev.position + 1
    return go({ ...state, steps: [...state.steps, { ...prev, note, string: next.name, finger, shift: 0 }], closed: false })
  }

  return go({ steps: [first], shifts: [], source, stats, closed: false })
}

// A fingering with shift sizes from `inventory` (as in `inventoryFromString`),
// only on the strings in `distrib` (`GDAE` or `0123`).
export function modeFingeringGen(
  ms: ModeShiftGen,
  inventory: number[] | string,
  distrib: string,
  stats: ChoiceStats<number, number> = new Map(),
): Fingering | null {
  const inv = typeof inventory === 'string' ? inventoryFromString(inventory) : inventory
  const strings = distrib.split('').map(st => stringNames['0123'.includes(st) ? Number(st) : 'GDAE'.indexOf(st)])
  return searchFingering(ms, inventorySource(stockFromInventory(inv), strings), stats)
}

// A fingering taking exactly the shifts of a `shiftsDistributed` sketch
// ('2G-1D-3A'), choosing only the fingers they start from; letters already in
// the sketch are ignored.
export function sketchFingeringGen(ms: ModeShiftGen, sketch: string, stats: ChoiceStats<number, number> = new Map()): Fingering | null {
  return searchFingering(ms, sketchSource(parseShiftPlan(sketch)), stats)
}

// The playable sketches of an exercise, in order, fingered with the stats
// running through them.
export function sketchesFingeringGen(ms: ModeShiftGen, sketches: string[], stats: ChoiceStats<number, number> = new Map()): Fingering[] {
  return sketches.reduce<[Fingering[], ChoiceStats<number, number>]>(([acc, st], sketch) => {
    const fingering = sketchFingeringGen(ms, sketch, st)
    return fingering ? [[...acc, fingering], fingering.stats] : [acc, st]
  }, [[], stats])[0]
}
