import { describe, expect, test } from 'vitest'
import _ from 'lodash'
import { evalContents, evalRenderLine, rotateInterpolableLine } from './RandomizeLang'
import type { RenderLine } from './RandomizeLangTypes'
import { desMS } from './RandomizeLangUtils'

const card = (key: string) =>
  evalContents(`S-3ocFingered: [\\[${JSON.stringify(key)}\\]]key:freeze:inline [ExFingered3oc.tags(fields, rotating)]`)[0]

const fields = (line: RenderLine): Record<string, string[]> =>
  Object.fromEntries((line.source?.substitutions || []).map(s => [s.tag ?? '', s.contents]))

// the shifts are fingered plans adding up to the shown mode's shifts
const consistent = (line: RenderLine) => {
  const f = fields(line)
  expect(f.tempo).toStrictEqual([`${Number(f.div[0]) * Number(f.metro[0])}`])
  expect(line.contents).not.toMatch(/error|undefined|NaN/)
  f.shifts.forEach(plan => {
    expect(plan).toMatch(/^(([1-3][xywz]|4)[GDAE](-([1-3][xywz]|4)[GDAE])*)?$/)
    expect(_.sum(plan.split('-').filter(x => x).map(x => Number(x[0])))).toBe(desMS(f.mode[0]).shifts)
  })
}

describe('Fingered3oc', () => {
  test('one card in the given key, major or minor', () => {
    for (const key of ['G', 'F#m', 'Eb', 'Bbm']) {
      const line = card(key)
      expect(line.key).toBe('S-3ocFingered')
      expect(fields(line).key).toStrictEqual([key])
      expect(fields(line).mode.length).toBe(7)
      consistent(line)
    }
  })

  test('a re-roll keeps the key and stays consistent', () => {
    for (let trial = 0; trial < 20; trial++) consistent(evalRenderLine(card('D')))
  })

  test('rotating the mode re-fingers the shifts for it', () => {
    const line = card('A')
    for (let trial = 0; trial < 7; trial++) consistent(rotateInterpolableLine(line, 'mode'))
  })
})
