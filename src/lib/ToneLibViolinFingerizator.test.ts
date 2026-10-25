import { describe, expect, test } from 'vitest'
import _ from 'lodash'
import { shiftsDistributed } from './Combinatorics.ts'
import { findMajor, parseNote, renderN } from './ToneLib.ts'
import { modeShiftsGen } from './ToneLibViolin.ts'
import { expectPlays } from './ToneLibViolinFingerizator.expect.ts'
import { Fingering, modeFingeringGen, parseShiftPlan, renderShiftPlan, sketchesFingeringGen, sketchFingeringGen } from './ToneLibViolinFingerizator.ts'

describe('ToneLibViolinFingerizator', () => {
  describe('the trace plays the three-octave scale up', () => {
    const modes = 'C G D A E B F# C# F Bb Eb Ab Db Gb Cb'.split(' ').flatMap(k =>
      _.range(3).flatMap(() => modeShiftsGen(findMajor(parseNote(k)!)!, 'dia', 0, 0)).filter(ms => ms.diatonicShifts >= 0))

    test('from shiftsDistributed sketches', () => {
      modes.forEach(ms => {
        const sketches = shiftsDistributed(ms.diatonicShifts, '-1-2', '011222233333', ms.startString).slice(0, 10)
        const fingerings = sketchesFingeringGen(ms, sketches)
        expect(fingerings.length).toBeGreaterThan(0)
        fingerings.forEach(f => expectPlays(ms, f))
      })
    })

    test('from an inventory', () => {
      modes.forEach(ms => {
        const fingering = modeFingeringGen(ms, '1-2-34', 'GDAE')
        expect(fingering).not.toBeNull()
        expectPlays(ms, fingering!)
      })
    })
  })

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
      ])).toBe('2xG-4D-1zE')
    })

    test('round-trips through parseShiftPlan', () => {
      expect(renderShiftPlan(parseShiftPlan('3yA-2wD-4D-1xE'))).toBe('3yA-2wD-4D-1xE')
    })
  })

  describe('parseShiftPlan', () => {
    test('the letter counts up from the first finger a shift can start from', () => {
      expect(parseShiftPlan('1xG-1zG-2yD-2wD-3yA-4E')).toStrictEqual([
        { size: 1, finger: 1, string: 'G' },
        { size: 1, finger: 4, string: 'G' },
        { size: 2, finger: 3, string: 'D' },
        { size: 2, finger: 4, string: 'D' },
        { size: 3, finger: 4, string: 'A' },
        { size: 4, finger: 4, string: 'E' },
      ])
    })

    test('without a letter, the first finger it can', () => {
      expect(parseShiftPlan('1G-2D-3A')).toStrictEqual(parseShiftPlan('1xG-2xD-3xA'))
    })
  })
})
