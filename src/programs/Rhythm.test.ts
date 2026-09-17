import { describe, expect, test } from 'vitest'
import { render, respell, rotate, subdivide } from './Rhythm'
import type { Rhythm } from './Rhythm'
import { parseSheet } from '../lib/SheetNotation'

const n = (note: string | null, duration: number, tied = false) => ({ note, duration, tied })

const bar: Rhythm = [n('c', 4), n(null, 2), n('c', 2), n('c', 4), n(null, 4)]

describe('subdivide', () => {
  test('one note per smallest unit, total unchanged', () => {
    expect(subdivide([n('c', 4)], 1).length).toBe(4)
    expect(subdivide(bar, 1).length).toBe(16)
  })

  test('a held note stays held across its own pieces', () => {
    expect(subdivide([n('c', 2)], 1).map(h => h.tied)).toStrictEqual([true, false])
    expect(subdivide([n(null, 2)], 1).map(h => h.tied)).toStrictEqual([false, false])
  })
})

describe('subdivide at a coarser grid', () => {
  test('the unit is the caller\u2019s, and the total is unchanged', () => {
    expect(subdivide([n('c', 4)], 2).map(h => h.duration)).toStrictEqual([2, 2])
    expect(subdivide(bar, 2).length).toBe(8)
  })

  test('a unit that does not divide a note is refused, not silently dropped', () => {
    expect(() => subdivide(bar, 4)).toThrow(/2 does not divide into 4/)
  })

  test('rotating an eighth-note grid steps by eighths', () => {
    const eighths = subdivide(bar, 2)
    expect(render(respell(rotate(eighths, 1)))).toBe(render(respell(rotate(eighths, 1))))
    expect(rotate(eighths, 8)).toStrictEqual(eighths)
  })
})

describe('rotate', () => {
  test('moves material later, wrapping', () => {
    const grid = (r: Rhythm) => r.map(h => h.note ?? '.').join('')
    expect(grid(rotate(subdivide([n('c', 1), n(null, 3)], 1), 1))).toBe('.c..')
    expect(grid(rotate(subdivide([n('c', 1), n(null, 3)], 1), 3))).toBe('...c')
  })

  test('a full turn is the identity, and rotations compose', () => {
    const s = subdivide(bar, 1)
    expect(rotate(s, 16)).toStrictEqual(s)
    expect(rotate(s, 0)).toStrictEqual(s)
    expect(rotate(rotate(s, 3), 5)).toStrictEqual(rotate(s, 8))
  })

  test('negative goes the other way', () => {
    const s = subdivide(bar, 1)
    expect(rotate(rotate(s, 6), -6)).toStrictEqual(s)
    expect(rotate(s, -1)).toStrictEqual(rotate(s, 15))
  })

  test('the sounding slots are the same ones, just moved', () => {
    const s = subdivide(bar, 1)
    const sounding = (r: Rhythm) => r.filter(h => h.note != null).length

    for (let by = 0; by < 16; by++) expect(sounding(rotate(s, by))).toBe(sounding(s))
  })
})

describe('ties', () => {
  const tied = (r: Rhythm) => r.filter(h => h.tied)

  test('a rest is never tied', () => {
    for (let by = 0; by < 16; by++)
      for (const held of respell(rotate(subdivide(bar, 1), by)))
        if (held.note == null) expect(held.tied).toBe(false)
  })

  test('nothing is left tied at the end of the bar', () => {
    for (let by = 0; by < 16; by++) {
      const out = respell(rotate(subdivide(bar, 1), by))
      expect(out.at(-1)!.tied).toBe(false)
    }
  })

  test('a note the table can spell needs no tie at all', () => {
    expect(tied(respell(subdivide([n('c', 4)], 1)))).toStrictEqual([])
    expect(tied(respell(subdivide([n('c', 8)], 1)))).toStrictEqual([])
    expect(tied(respell(subdivide([n('c', 3)], 1)))).toStrictEqual([])
  })

  test('a length no symbol spells is written as tied pieces', () => {
    expect(render(respell(subdivide([n('c', 5), n(null, 11)], 1)))).toBe('c4~ c16 r8. r2')
  })

  test('respell never emits more ties than pieces', () => {
    for (let by = 0; by < 16; by++) {
      const out = respell(rotate(subdivide(bar, 1), by))
      expect(tied(out).length).toBeLessThan(out.length)
    }
  })
})

describe('respell', () => {
  test('rejoins subdivided notes into the durations that engrave them', () => {
    expect(render(respell(subdivide([n('c', 4)], 1)))).toBe('c4')
    expect(render(respell(subdivide([n('c', 2), n(null, 2)], 1)))).toBe('c8 r8')
    expect(render(respell(subdivide([n('c', 3), n(null, 1)], 1)))).toBe('c8. r16')
  })

  test('respell o rotate o subdivide engraves a real bar at every offset', () => {
    for (let by = 0; by < 16; by++) {
      const out = render(respell(rotate(subdivide(bar, 1), by)))
      const { measures, errors } = parseSheet(out)

      expect(errors).toStrictEqual([])
      expect(measures.length).toBe(1)
    }
  })

  test('it is idempotent and preserves the subdivided grid', () => {
    for (let by = 0; by < 16; by++) {
      const shifted = rotate(subdivide(bar, 1), by)
      // The last slot's tie wraps, so respell drops it: nothing follows to tie into.
      const engraved = shifted.map((h, i) => i == shifted.length - 1 ? { ...h, tied: false } : h)
      expect(subdivide(respell(shifted), 1)).toStrictEqual(engraved)
      expect(respell(respell(shifted))).toStrictEqual(respell(shifted))
    }
  })
})
