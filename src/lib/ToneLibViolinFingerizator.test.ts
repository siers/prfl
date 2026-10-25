import { describe, expect, test } from 'vitest'
import _ from 'lodash'
import { findMajor, parseNote, renderN } from './ToneLib.ts'
import { modeShiftsGen } from './ToneLibViolin.ts'
import { Fingering, modeFingeringGen, parseShiftPlan, renderShiftPlan, sketchesFingeringGen, sketchFingeringGen } from './ToneLibViolinFingerizator.ts'

describe('ToneLibViolinFingerizator', () => {
  describe('modeFingeringGen', () => {
    // G ionian from the open G, three octaves ending on 4: five diatonic shifts
    const gIon = () => modeShiftsGen(findMajor(parseNote('g')!)!, 'maj', 0, 4)[0]
    const shiftsOf = (fingering: Fingering) => parseShiftPlan(fingering.plan)

    test('walks up to the end note and finger, the shifts adding up', () => {
      const ms = gIon()
      expect(ms.diatonicShifts).toBe(5)
      const fingering = modeFingeringGen(ms, '1-2-34', 'GDAE')!
      const last = fingering.steps.at(-1)!
      expect([renderN(last.note), last.string, last.finger]).toStrictEqual([renderN(ms.endNote), 'E', 4])
      expect(_.sumBy(shiftsOf(fingering), sh => sh.size)).toBe(5)
    })

    test('the plan is the shifts the steps take, each from a finger it can start from', () => {
      const fingering = modeFingeringGen(gIon(), '-1-2-3', 'GDAE')!
      const taken = fingering.steps.flatMap((st, i) => st.shift ? [{ size: st.shift, finger: fingering.steps[i - 1].finger, string: fingering.steps[i - 1].string }] : [])
      expect(taken).toStrictEqual(shiftsOf(fingering))
      taken.forEach(sh => expect(sh.finger).toBeGreaterThanOrEqual(sh.size))
    })

    test('shifts only on the distributed strings, within the inventory', () => {
      const shifts = shiftsOf(modeFingeringGen(gIon(), '1-2-34', 'E')!)
      shifts.forEach(sh => expect(sh.string).toBe('E'))
      ;[1, 4].forEach(size => expect(shifts.filter(sh => sh.size == size).length).toBeLessThanOrEqual(1))
    })

    test('none when the shifts cannot add up', () => {
      expect(modeFingeringGen(gIon(), '', 'GDAE')).toBeNull()
      expect(modeFingeringGen({ ...gIon(), diatonicShifts: -1 }, '-1', 'GDAE')).toBeNull()
    })

    test('records each shift\'s starting finger by its size', () => {
      const { plan, stats } = modeFingeringGen(gIon(), '-1-2-3', 'GDAE')!
      const bySize = _.groupBy(parseShiftPlan(plan), sh => sh.size)
      expect(Object.fromEntries(stats)).toStrictEqual(_.mapValues(bySize, shs => shs.map(sh => sh.finger)))
    })
  })

  describe('sketchFingeringGen', () => {
    const gIon = () => modeShiftsGen(findMajor(parseNote('g')!)!, 'maj', 0, 4)[0]
    const unlettered = (plan: string) => plan.replace(/[xywz]/g, '')

    test('takes exactly the sketch\'s shifts, choosing the fingers', () => {
      const ms = gIon()
      const fingering = sketchFingeringGen(ms, '2G-1D-2D')!
      expect(unlettered(fingering.plan)).toBe('2G-1D-2D')
      const last = fingering.steps.at(-1)!
      expect([renderN(last.note), last.finger]).toStrictEqual([renderN(ms.endNote), 4])
    })

    test('none when a shift is below the starting string', () => {
      // D ionian starts on the open D string
      const dIon = modeShiftsGen(findMajor(parseNote('d')!)!, 'maj', 0, 4)[0]
      expect(dIon.startString).toBe('D')
      expect(sketchFingeringGen(dIon, '2G-3A')).toBeNull()
    })

    test('keeps the playable sketches in order, the stats running through them', () => {
      const fingerings = sketchesFingeringGen(gIon(), ['2G-3A', '5G', '3D-2E'])
      expect(fingerings.map(f => unlettered(f.plan))).toStrictEqual(['2G-3A', '3D-2E'])
      const fingers = fingerings.flatMap(f => parseShiftPlan(f.plan))
      expect(Object.fromEntries(fingerings.at(-1)!.stats)).toStrictEqual(
        _.mapValues(_.groupBy(fingers, sh => sh.size), shs => shs.map(sh => sh.finger)))
    })
  })

  describe('renderShiftPlan', () => {
    test('writes the starting finger, but not for a 4', () => {
      expect(renderShiftPlan([
        { size: 2, finger: 2, string: 'G' },
        { size: 4, finger: 4, string: 'D' },
        { size: 1, finger: 4, string: 'E' },
      ])).toBe('2yG-4D-1zE')
    })

    test('round-trips through parseShiftPlan', () => {
      expect(renderShiftPlan(parseShiftPlan('3wA-4D-1xE'))).toBe('3wA-4D-1xE')
    })
  })

  describe('parseShiftPlan', () => {
    test('parses the starting finger, the first available without a letter', () => {
      expect(parseShiftPlan('2yG-3D-1xE')).toStrictEqual([
        { size: 2, finger: 2, string: 'G' },
        { size: 3, finger: 3, string: 'D' },
        { size: 1, finger: 1, string: 'E' },
      ])
    })
  })
})
