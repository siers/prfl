import { describe, expect, test } from 'vitest'
import _ from 'lodash'
import { evalContents, evalRenderLine, rotateInterpolableLine } from './RandomizeLang'
import type { RenderLine } from './RandomizeLangTypes'
import { desMS } from './RandomizeLangUtils'

const card = (key: string, params: string) =>
  evalContents(`S-3ocFingered: [\\[${JSON.stringify(key)}\\]]key:freeze:inline [ExFingered3oc.tags(fields, rotating, ${params})]`)[0]

const fields = (line: RenderLine): Record<string, string[]> =>
  Object.fromEntries((line.source?.substitutions || []).map(s => [s.tag ?? '', s.contents]))

const fingeredPlan = /^((1[xywz]|2[xyw]|3[xy]|4)[GDAE](-(1[xywz]|2[xyw]|3[xy]|4)[GDAE])*)?$/
const plainPlan = /^(\d[GDAE](-\d[GDAE])*)?$/

// stepwise scales get fingered plans adding up to the shown mode's shifts, the
// others S-3oc's plain ones
const consistent = (line: RenderLine) => {
  const f = fields(line)
  expect(f.tempo).toStrictEqual([`${Number(f.div[0]) * Number(f.metro[0])}`])
  expect(line.contents).not.toMatch(/error|undefined|NaN/)
  const ms = desMS(f.mode[0])
  f.shifts.forEach(plan => {
    expect(plan).toMatch(['dia', 'hm', 'mm'].includes(ms.scale) ? fingeredPlan : plainPlan)
    expect(_.sum(plan.split('-').filter(x => x).map(x => Number(x[0])))).toBe(ms.shifts)
  })
}

describe('Fingered3oc', () => {
  test('one card in the given key, major or minor', () => {
    for (const key of ['G', 'F#m', 'Eb', 'Bbm']) {
      const line = card(key, `{ scales: 'dia hm mm' }`)
      expect(line.key).toBe('S-3ocFingered')
      expect(fields(line).key).toStrictEqual([key])
      expect(fields(line).mode.length).toBe(7)
      consistent(line)
    }
  })

  test('takes the scales', () => {
    for (let trial = 0; trial < 10; trial++) {
      const line = evalRenderLine(card('D', `{ scales: 'hm mm chr' }`))
      fields(line).mode.forEach(mode => expect(['hm', 'mm', 'chr']).toContain(desMS(mode).scale))
      consistent(line)
    }
  })

  test('takes the modulations, fingering in the moved key', () => {
    for (let trial = 0; trial < 10; trial++) {
      const line = evalRenderLine(card('C', `{ scales: 'dia,', modulations: '-1, +1, +6, sub' }`))
      const f = fields(line)
      expect(['-1', '+1', '+6', 'sub']).toContain(f.modulation[0])
      expect(f.target[0]).not.toBe('-')
      consistent(line)
    }
  })

  test('a re-roll keeps the key and stays consistent', () => {
    for (let trial = 0; trial < 20; trial++) consistent(evalRenderLine(card('D', `{ scales: 'dia,' }`)))
  })

  test('rotating the mode re-fingers the shifts for it', () => {
    let line = card('A', `{ scales: 'dia,' }`)
    for (let trial = 0; trial < 7; trial++) {
      line = rotateInterpolableLine(line, 'mode')
      consistent(line)
    }
  })
})
