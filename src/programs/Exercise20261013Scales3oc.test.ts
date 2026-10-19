import { describe, expect, test } from 'vitest'
import { evalContents, evalRenderLine, rotateInterpolableLine } from './RandomizeLang'
import type { RenderLine } from './RandomizeLangTypes'
import { desMS } from './RandomizeLangUtils'

const keyz = (keys: string[]) => `[\\[${keys.map(k => JSON.stringify(k)).join(',')}\\]]`
const card = (...keys: string[]) =>
  evalContents(`S-3oc: ${keyz(keys)}key:freeze:inline [ExScales3oc.tags(fields, rotating, { scales: 'dia hm mm' })]`)[0]
const nearCard = (key: string) =>
  evalContents(`S-3oc-near: ${keyz([key])}key:freeze:inline [ExScales3oc.tags(fields, rotating, { scales: 'dia,', modulations: '-1, +1, +6, sub' })]`)[0]

const fields = (line: RenderLine): Record<string, string[]> =>
  Object.fromEntries((line.source?.substitutions || []).map(s => [s.tag ?? '', s.contents]))

const consistent = (line: RenderLine) => {
  const f = fields(line)
  expect(f.tempo).toStrictEqual([`${Number(f.div[0]) * Number(f.metro[0])}`])
  expect(f.offset.length).toBe(Number(f.div[0]))
  expect(line.contents).not.toMatch(/error|undefined|NaN/)
}

describe('Scales3oc', () => {
  test('one card keyed S-3oc, in the given key', () => {
    const line = card('G')
    expect(line.key).toBe('S-3oc')
    expect(fields(line).key).toStrictEqual(['G'])
    expect(fields(line).mode.length).toBe(7)
    consistent(line)
  })

  test('the source spits out the tags the written card had', () => {
    expect(card('D').source?.substitutions?.map(s => [s.tag, s.tags])).toStrictEqual([
      ['key', ['freeze', 'inline']],
      ['div', ['show-1', 'inline', 'nonrotated']],
      ['offset', ['show-1', 'computed', 'inline']],
      ['metro', ['show-1', 'inline']],
      ['per', ['inline']],
      ['tempo', ['computed', 'inline']],
      ['mode', ['cut-semi', 'maxlen-80', 'show-4']],
      ['inv', ['inline', 'show-1', 'nonrotated']],
      ['shifts', ['computed', 'show-1', 'inline']],
      ['additional', ['computed']],
    ])
  })

  test('several keys make a rotating key field', () => {
    expect(fields(card('C', 'Bb')).key).toStrictEqual(['C', 'Bb'])
  })

  test('a re-roll runs the source again, keeping the key', () => {
    for (let trial = 0; trial < 20; trial++) {
      const line = evalRenderLine(card('Eb'))
      expect(fields(line).key).toStrictEqual(['Eb'])
      consistent(line)
    }
  })

  test('rotating div re-derives offset and tempo, keeping the rest', () => {
    const line = card('E')
    const rotated = rotateInterpolableLine(line, 'div')
    expect(fields(rotated).div[0]).toBe(fields(line).div[1])
    expect(fields(rotated).mode).toStrictEqual(fields(line).mode)
    expect(fields(rotated).metro).toStrictEqual(fields(line).metro)
    consistent(rotated)
  })

  test('rotating the line re-derives from the next mode', () => {
    const line = card('A')
    const rotated = rotateInterpolableLine(line)
    expect(fields(rotated).mode[0]).toBe(fields(line).mode[1])
    expect(fields(rotated).div).toStrictEqual(fields(line).div)
    expect(fields(rotated).additional).toStrictEqual([desMS(fields(rotated).mode[0]).additional || '-'])
    consistent(rotated)
  })

  describe('with modulations', () => {
    test('rolls a modulation and deals the modes in the moved key', () => {
      const line = nearCard('D')
      const f = fields(line)
      expect(line.key).toBe('S-3oc-near')
      expect([...f.modulation].sort()).toStrictEqual(['+1', '+6', '-1', 'sub'])
      expect(f.target).toStrictEqual([{ '+1': 'Eb', '-1': 'Db', '+6': 'Ab', sub: 'Bbm' }[f.modulation[0]]])
      expect(f.mode.length).toBe(7)
      consistent(line)
    })

    test('`dia,` is the one scale dia, not its characters', () => {
      expect(fields(nearCard('D')).mode.every(m => m.includes('.dia:'))).toBe(true)
    })

    test('the modulation tags come first, after the frozen key', () => {
      expect(nearCard('D').source?.substitutions?.map(s => s.tag)).toStrictEqual(
        ['key', 'modulation', 'target', 'div', 'offset', 'metro', 'per', 'tempo', 'mode', 'inv', 'shifts', 'additional'])
    })

    test('clicking the modulation re-derives the target', () => {
      const line = nearCard('D')
      const rotated = rotateInterpolableLine(line, 'modulation')
      expect(fields(rotated).modulation[0]).toBe(fields(line).modulation[1])
      expect(fields(rotated).target).not.toStrictEqual(fields(line).target)
    })

    test('a re-roll keeps the key', () => {
      const line = evalRenderLine(nearCard('F'))
      expect(fields(line).key).toStrictEqual(['F'])
      consistent(line)
    })
  })
})
