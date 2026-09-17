import { describe, expect, test } from 'vitest'
import { gen, internals } from './ExerciseBowedTies'

const { arrangements, bowedBar } = internals
import { parseSheet, DIVISIONS } from '../lib/SheetNotation'

describe('arrangements', () => {
  test('distinct orderings only, not every permutation', () => {
    expect(arrangements('1100')).toStrictEqual(['0011', '0101', '0110', '1001', '1010', '1100'])
    expect(arrangements('1110')).toStrictEqual(['0111', '1011', '1101', '1110'])
    expect(arrangements('0001')).toStrictEqual(['0001', '0010', '0100', '1000'])
  })

  test('every arrangement keeps the same bits', () => {
    for (const bits of ['1110', '1100', '0001'])
      for (const a of arrangements(bits))
        expect([...a].sort().join('')).toBe([...bits].sort().join(''))
  })
})

describe('bowedBar', () => {
  test('0 is a cross notehead, 1 is ordinary, every note is c', () => {
    expect(bowedBar('1100')).toBe('c8n c8v c8n[x] c8v[x]')
  })

  test('bowings alternate note to note across the whole bar', () => {
    expect(bowedBar('11111111').split(' ').map(t => t[2])).toStrictEqual([...'nvnvnvnv'])
  })
})

describe('gen', () => {
  test('each bar is one full 4/4 measure of eight eighths', () => {
    const bars = gen()
    expect(bars.length).toBe(9)

    for (const bar of bars) {
      const { measures, errors } = parseSheet(bar)
      expect(errors).toStrictEqual([])
      expect(measures.length).toBe(1)
      expect(measures[0].length).toBe(8)
      expect(measures[0].reduce((a, n) => a + n.duration, 0)).toBe(DIVISIONS * 4)
    }
  })

  test('every note is a c, nothing is tied, and 0s are the crossed ones', () => {
    for (const bar of gen()) {
      const bits = bar.split(' ').map(t => t.includes('[x]') ? '0' : '1').join('')
      const { measures } = parseSheet(bar)

      measures[0].forEach((n, i) => {
        expect(n.note?.name).toBe('c')
        expect(n.tied).not.toBe(true)
        expect(n.shape).toBe(bits[i] == '0' ? 'x' : undefined)
      })
    }
  })

  test('the bowing alternates down/up over all 12 notes', () => {
    for (const bar of gen())
      expect(parseSheet(bar).measures[0].map(n => n.bowing))
        .toStrictEqual([...'nvnvnvnv'].map(c => c == 'n' ? 'down' : 'up'))
  })
})
