import { describe, expect, test } from 'vitest'
import { gen } from './ExerciseBowedTies'
import { parseSheet, DIVISIONS } from '../lib/SheetNotation'

const tokens = (sheet: string) => sheet.split(' ').filter(t => t != '|')
const sounding = (sheet: string) => tokens(sheet).filter(t => !t.startsWith('r'))

describe('gen', () => {
  test('every token is a quarter, a ghost, a pause or a bowed eighth', () => {
    for (let trial = 0; trial < 100; trial++)
      for (const t of tokens(gen()))
        expect(t).toMatch(/^(c[48][nv](\[x\])?|r4)$/)
  })

  test('it fills eight beats: two full 4/4 measures', () => {
    for (let trial = 0; trial < 100; trial++) {
      const { measures, errors } = parseSheet(gen())

      expect(errors).toStrictEqual([])
      expect(measures.length).toBe(2)
      for (const m of measures)
        expect(m.reduce((a, n) => a + n.duration, 0)).toBe(DIVISIONS * 4)
    }
  })

  test('a ghost is a crossed notehead on a c, never a pitch of its own', () => {
    for (let trial = 0; trial < 50; trial++)
      for (const n of parseSheet(gen()).measures.flat())
        if (n.note) {
          expect(n.note.name).toBe('c')
          expect([undefined, 'x']).toContain(n.shape)
        }
  })

  test('a pause takes no bow', () => {
    for (let trial = 0; trial < 100; trial++)
      for (const t of tokens(gen()))
        if (t.startsWith('r')) expect(t).toBe('r4')
  })

  test('the bow alternates across sounding notes, over barlines and past pauses', () => {
    for (let trial = 0; trial < 100; trial++)
      sounding(gen())
        .map(t => t[2])
        .forEach((bow, i) => expect(bow).toBe(i % 2 == 0 ? 'n' : 'v'))
  })

  test('ghosts are bowed like any other note', () => {
    for (let trial = 0; trial < 50; trial++)
      for (const t of sounding(gen()).filter(t => t.includes('[x]')))
        expect(t).toMatch(/^c[48][nv]\[x\]$/)
  })

  test('eight of the ten choices, so no beat can appear more than the pool allows', () => {
    for (let trial = 0; trial < 100; trial++) {
      const pauses = tokens(gen()).filter(t => t == 'r4').length
      expect(pauses).toBeLessThanOrEqual(2)
    }
  })

  test('every kind of beat turns up across many rolls', () => {
    const seen = new Set<string>()
    for (let trial = 0; trial < 200; trial++)
      for (const t of tokens(gen()))
        seen.add(t.replace(/[nv]/, ''))

    expect(seen).toContain('c8')
    expect(seen).toContain('c8[x]')
    expect(seen).toContain('c4')
    expect(seen).toContain('c4[x]')
    expect(seen).toContain('r4')
  })
})
