import { describe, expect, test } from 'vitest'
import { sumsFromTo, sumsFromToU, uniqueShifts, uniqueShiftsDF, uniqueShiftsF } from './Combinatorics.ts'

describe('Combinatorics', () => {
  test('sumsTo base: negative target', () => {
    expect(sumsToU(-1, [-1])).toEqual([])
  })

  test('sumsTo base: single step landing exactly', () => {
    expect(sumsToU(2, [-2])).toEqual([[2]])
  })

  test('sumsTo: step 2 up to 4', () => {
    expect(sumsToU(4, [-2])).toEqual([[2, 2]])
  })

  test('sumsTo: steps 1 and 2 up to 2', () => {
    expect(sumsToU(2, [-1, -2])).toEqual([[2], [1, 1]])
  })

  test('sumsTo: steps 2 and 3 up to 3', () => {
    expect(sumsToU(3, [-2, -3])).toEqual([[3]])
  })

  test('sumsTo: every way sums to the target', () => {
    for (const way of sumsTo(6, [-2, -3]))
      expect(way.reduce((a, b) => a + b, 0)).toBe(6)
  })

  test('sumsTo: no duplicate multisets', () => {
    const ways = sumsToU(5, [-1, -2, -3])
    const keys = ways.map(w => [...w].sort((a, b) => a - b).join(','))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('sumsTo: sorted by size', () => {
    const ways = sumsToU(7, [-2, -3, -4])
    const sizes = ways.map(w => w.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  test('sumsTo: finite inventory limits repeats', () => {
    expect(sumsToU(6, [2, 2])).toEqual([])
    expect(sumsToU(4, [2, 2])).toEqual([[2, 2]])
  })

  test('sumsTo: mixed finite and inexhaustible', () => {
    expect(sumsToU(5, [1, -2])).toEqual([[1, 2, 2]])
    expect(sumsToU(4, [1, -2])).toEqual([[2, 2]])
  })

  test('sumsTo: exhaustible values are tried before inexhaustible ones', () => {
    const ways = sumsTo(4, [3, -1])
    expect(ways[0]).toEqual([3, 1])
    expect(ways).toEqual([[3, 1], [1, 3], [1, 1, 1, 1]])
  })

  test('uniqueShifts 1,7', () => {
    expect(uniqueShifts(7, [1, -2, -3])).toStrictEqual(
      [
        [1, 2, 2, 2,],
        [1, 3, 3,],
        [2, 1, 2, 2,],
        [2, 2, 1, 2,],
        [2, 2, 2, 1,],
        [2, 2, 3,],
        [2, 3, 2,],
        [3, 1, 3,],
        [3, 2, 2,],
        [3, 3, 1,],
      ]
    )
  })

  test('uniqueShiftsF', () => {
    expect(uniqueShiftsF(7, [1, -2, -3])).toStrictEqual(
      [
        "1222",
        "133",
        "2122",
        "2212",
        "2221",
        "223",
        "232",
        "313",
        "322",
        "331",
      ]
    )
  })
})
