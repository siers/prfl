import { expect } from 'vitest'
import _ from 'lodash'
import { equalLetterOctave, rename, semi, stepN } from './ToneLib'
import { ModeShiftGen, stringIndex, strings3 } from './ToneLibViolin'
import { Fingering, FingeringStep } from './ToneLibViolinFingerizator'

// Test expectations shared by the fingerizator's tests and its users'.

// the scale, independently: 22 notes a diatonic step apart from the root, in the key
const scaleOf = (ms: ModeShiftGen) => _.range(22).map(i => rename(stepN(ms.root, i), ms.key))

// the note under a step's finger: the column of its position and finger, on its string
const sounding = (st: FingeringStep) => {
  const string = strings3[stringIndex(st.string)]
  const column = st.finger == 0 ? st.position - 1 : st.position + st.finger - 1
  return { letter: string.positions[column], base: string.base }
}

// The trace plays the mode's three-octave scale up, every note under its
// finger and not below its string, from the start finger to the end finger.
export function expectPlays(ms: ModeShiftGen, fingering: Fingering) {
  expect(fingering.steps.map(st => st.note)).toStrictEqual(scaleOf(ms))
  fingering.steps.forEach(st => {
    const { letter, base } = sounding(st)
    expect(equalLetterOctave(letter, st.note)).toBe(true)
    expect(semi(st.note)).toBeGreaterThanOrEqual(semi(base))
    if (st.finger == 0) expect(semi(st.note)).toBe(semi(base))
    expect(st.finger).toBeGreaterThanOrEqual(0)
    expect(st.finger).toBeLessThanOrEqual(4)
  })
  expect([fingering.steps[0].finger, fingering.steps.at(-1)!.finger]).toStrictEqual([ms.start, ms.end])
}
