import { describe, expect, test } from 'vitest'
import { gen } from './Exercise20261013Scales3oc'
import { evalContents, evalRenderLine, rotateInterpolableLine } from './RandomizeLang'
import type { RenderLine } from './RandomizeLangTypes'

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
    const lines = gen('S-3oc', 'G')
    expect(lines.length).toBe(1)
    expect(lines[0].key).toBe('S-3oc')
    expect(fields(lines[0]).key).toStrictEqual(['G'])
    consistent(lines[0])
  })

  test('the fields carry the tags the written card has', () => {
    expect(gen('S-3oc', 'D')[0].source?.interpols.map(i => [i.tag, i.tags])).toStrictEqual([
      ['key', ['freeze', 'inline']],
      ['div', ['show-1', 'inline', 'nonrotated']],
      ['offset', ['show-1', 'computed', 'inline']],
      ['metro', ['show-1', 'inline']],
      ['tempo', ['computed', 'inline']],
      ['mode', ['cut-semi', 'maxlen-80', 'show-4']],
      ['inv', ['inline', 'show-1', 'nonrotated']],
      ['shifts', ['computed', 'show-1', 'inline']],
      ['additional', ['computed']],
    ])
  })

  test('renders like the parser would', () => {
    const line = gen('S-3oc', 'D')[0]
    const parsed = evalContents(line.source!.contents.replace(/!!!(\d)/g, (_, n) => `[\\[${fields(line)[line.source!.interpols[n - 1].tag!].map(v => JSON.stringify(v)).join(',')}\\]]`))[0]
    expect(line.contents).toBe(parsed.contents)
  })

  test('several keys make a rotating key field', () => {
    expect(fields(gen('S-3oc', ['C', 'Bb'])[0]).key).toStrictEqual(['C', 'Bb'])
  })

  test('it comes out of an explode, like blockLines', () => {
    const [line] = evalContents("{ExScales3oc.gen('S-3oc', 'A')}")
    expect(line.key).toBe('S-3oc')
    expect(fields(line).mode.length).toBe(7)
  })

  test('a re-roll runs the fields again in the DSL, keeping the key', () => {
    for (let trial = 0; trial < 20; trial++) {
      const line = evalRenderLine(gen('S-3oc', 'Eb')[0])
      expect(fields(line).key).toStrictEqual(['Eb'])
      consistent(line)
    }
  })

  test('rotating div re-derives offset and tempo', () => {
    const line = gen('S-3oc', 'E')[0]
    const rotated = rotateInterpolableLine(line, 'div')
    expect(fields(rotated).div[0]).toBe(fields(line).div[1])
    consistent(rotated)
  })
})
